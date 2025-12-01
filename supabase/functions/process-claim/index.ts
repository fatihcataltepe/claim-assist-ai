import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claimId, userMessage, conversationHistory } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get claim data
    const { data: claim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (!claim) {
      throw new Error('Claim not found');
    }

    console.log('Current claim status:', claim.status);
    console.log('User message:', userMessage);

    // Build context for AI
    const contextInfo = `
Current Claim Status: ${claim.status}
Current Data:
- Policy Number: ${claim.policy_number || 'Not provided'}
- Location: ${claim.location || 'Not provided'}
- Incident: ${claim.incident_description || 'Not provided'}
- Driver Name: ${claim.driver_name || 'Not provided'}
- Vehicle: ${claim.vehicle_make || ''} ${claim.vehicle_model || ''} ${claim.vehicle_year || ''}
- Coverage Status: ${claim.is_covered === null ? 'Not checked' : claim.is_covered ? 'Covered' : 'Not covered'}
${claim.coverage_details ? `- Coverage Details: ${claim.coverage_details}` : ''}
${claim.arranged_services?.length > 0 ? `- Services Arranged: ${claim.arranged_services.length}` : ''}
`;

    // JSON format instruction for AI
    const jsonFormatInstruction = `
**ABSOLUTELY CRITICAL - YOU MUST OUTPUT ONLY JSON**

YOU ARE REQUIRED TO OUTPUT VALID JSON. NO EXCEPTIONS.

DO NOT OUTPUT PLAIN TEXT. DO NOT OUTPUT MARKDOWN. ONLY JSON.

Your ENTIRE response must be a single JSON object starting with { and ending with }

EXAMPLE OF CORRECT OUTPUT:
{
  "message": "Can you tell me the year, make, and model of your vehicle?",
  "extracted_data": {},
  "decisions": {
    "user_confirmed": false,
    "needs_data_confirmation": false,
    "needs_service_confirmation": false
  },
  "next_stage": "data_gathering"
}

REQUIRED JSON STRUCTURE:
{
  "message": "Your natural language response to the user - PUT ALL COMMUNICATION HERE",
  "extracted_data": {
    "driver_name": "string or omit",
    "driver_phone": "string or omit", 
    "policy_number": "string or omit",
    "location": "string or omit",
    "incident_description": "string or omit",
    "vehicle_make": "string or omit",
    "vehicle_model": "string or omit",
    "vehicle_year": number or omit
  },
  "decisions": {
    "user_confirmed": boolean,
    "needs_data_confirmation": boolean,
    "needs_service_confirmation": boolean
  },
  "next_stage": "data_gathering" | "coverage_check" | "arranging_services" | "notification_sent" | "completed"
}

FORBIDDEN:
❌ Plain text responses
❌ Markdown code blocks
❌ Any text before {
❌ Any text after }

MANDATORY:
✓ Start with {
✓ End with }
✓ Valid JSON only`;

    // Build system prompt with stage-specific instructions
    let stageInstructions = '';
    
    if (claim.status === 'data_gathering') {
      const hasRequiredInfo = !!(claim.policy_number && claim.location && claim.incident_description);
      
      if (!hasRequiredInfo) {
        stageInstructions = `
You are gathering information. You need these 3 REQUIRED pieces:
1. Policy number
2. Location (where incident occurred)  
3. Incident description (what happened)

Continue collecting this information naturally. Extract any data provided in the user's message.
Set next_stage to "data_gathering" until you have all 3 required pieces.`;
      } else {
        // Check if user is confirming (simple yes/confirmed/ok response)
        const isConfirming = userMessage.toLowerCase().trim().match(/^(yes|confirmed?|correct|that'?s?\s+right|ok|yeah|yep|sure)$/i);
        
        if (isConfirming) {
          stageInstructions = `
User has confirmed the details are correct. 
- Acknowledge briefly (one sentence)
- Set user_confirmed to true
- Set needs_data_confirmation to false
- Set next_stage to "coverage_check" (we'll check coverage now)`;
        } else {
          stageInstructions = `
You have all required information! Now:
1. Summarize what you collected in a clear list
2. Ask user: "Is this information correct?" or "Can you confirm these details?"
3. Set needs_data_confirmation to true
4. Stay at "data_gathering" (wait for user to confirm)`;
        }
      }
    } else if (claim.status === 'coverage_check') {
      if (claim.is_covered === null) {
        stageInstructions = `
Coverage check needs to be performed. Keep next_stage as "coverage_check".`;
      } else {
        stageInstructions = `
Coverage Status: ${claim.is_covered ? '✅ COVERED' : '❌ NOT COVERED'}
${claim.coverage_details}

YOUR RESPONSE MUST:
1. Explicitly tell the user if they are covered or not
2. Explain the coverage details
3. ${claim.is_covered ? 'Ask if they want to proceed with arranging services' : 'Explain next steps'}
4. Set needs_service_confirmation to true if covered
5. Set next_stage to "arranging_services" ONLY if user confirms AND is covered`;
      }
    } else if (claim.status === 'arranging_services' || claim.status === 'notification_sent') {
      const services = claim.arranged_services || [];
      if (services.length > 0 && claim.status === 'arranging_services') {
        stageInstructions = `
Services have been successfully arranged! You MUST inform the user about EVERY service with complete details:

${services.map((s: any) => `- **${s.service_type.toUpperCase()}**: ${s.provider_name}, Phone: ${s.provider_phone}, Estimated arrival: ${s.estimated_arrival} minutes`).join('\n')}

YOUR RESPONSE MUST:
1. Clearly state that ALL services have been arranged (not just "noted")
2. List EACH service with provider name, phone number, and ETA
3. Be specific and detailed about what was arranged
4. Set next_stage to "notification_sent"`;
      } else if (claim.status === 'notification_sent') {
        // Check if user is confirming completion
        const isConfirming = userMessage.toLowerCase().trim().match(/^(yes|confirmed?|correct|that'?s?\s+right|ok|yeah|yep|sure|complete|done)$/i);
        
        if (isConfirming) {
          stageInstructions = `
User has confirmed they want to complete the claim.
- Acknowledge the completion with a friendly closing message
- Set user_confirmed to true
- Set next_stage to "completed"`;
        } else {
          stageInstructions = `
All services have been arranged and notifications sent. 
- Ask the user if they would like to mark this claim as completed
- Mention they can always reach out if they need further assistance
- Set next_stage to "notification_sent" (stay here until confirmed)`;
        }
      } else {
        stageInstructions = `
User has confirmed they want services arranged. Acknowledge this and set next_stage to "arranging_services" so services can be dispatched.`;
      }
    } else if (claim.status === 'completed') {
      stageInstructions = `
Claim is completed. Thank the user and let them know they can reach out if they need anything else.
Set next_stage to "completed".`;
    }

    const systemPrompt = `You are an AI insurance claims assistant. Your job is to help drivers through the claims process.

${contextInfo}

${stageInstructions}

${jsonFormatInstruction}

Communication Style:
- Professional, clear, and reassuring
- Be explicit about stage transitions
- Ask for confirmations before major transitions`;

    // Get AI response
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;
    
    console.log('AI raw response:', aiMessage);

    // Parse the JSON response - with robust extraction
    let structuredResponse;
    try {
      // First try direct parsing
      structuredResponse = JSON.parse(aiMessage);
    } catch (parseError) {
      // If that fails, try to extract JSON from the response
      console.log('Direct JSON parse failed, attempting extraction...');
      try {
        // Remove markdown code blocks if present
        let cleanedMessage = aiMessage.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        
        // Try to find JSON object
        const jsonMatch = cleanedMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structuredResponse = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from response');
        } else {
          // Fallback: Create a valid response from plain text
          console.warn('No JSON found, creating fallback response from plain text');
          structuredResponse = {
            message: aiMessage.trim(),
            extracted_data: {},
            decisions: {
              user_confirmed: false,
              needs_data_confirmation: false,
              needs_service_confirmation: false
            },
            next_stage: "data_gathering"
          };
        }
      } catch (extractError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('Failed to extract JSON:', extractError);
        console.error('Raw response:', aiMessage);
        
        // Final fallback: return error message as response
        structuredResponse = {
          message: "I apologize, I encountered a technical issue. Could you please repeat that?",
          extracted_data: {},
          decisions: {
            user_confirmed: false,
            needs_data_confirmation: false,
            needs_service_confirmation: false
          },
          next_stage: "data_gathering"
        };
      }
    }
    
    console.log('Structured response:', structuredResponse);

    // Merge extracted data with existing claim data
    const updatedClaimData = {
      driver_name: structuredResponse.extracted_data.driver_name || claim.driver_name || '',
      driver_phone: structuredResponse.extracted_data.driver_phone || claim.driver_phone || '',
      policy_number: structuredResponse.extracted_data.policy_number || claim.policy_number || '',
      location: structuredResponse.extracted_data.location || claim.location || '',
      incident_description: structuredResponse.extracted_data.incident_description || claim.incident_description || '',
      vehicle_make: structuredResponse.extracted_data.vehicle_make || claim.vehicle_make,
      vehicle_model: structuredResponse.extracted_data.vehicle_model || claim.vehicle_model,
      vehicle_year: structuredResponse.extracted_data.vehicle_year || claim.vehicle_year,
    };

    console.log('Updated claim data:', updatedClaimData);

    // Determine next status and perform actions based on structured response
    let nextStatus = structuredResponse.next_stage;
    let additionalData: any = {};

    // Check if we need to verify coverage
    if (nextStatus === 'coverage_check' && structuredResponse.decisions.user_confirmed && claim.is_covered === null) {
      console.log('Checking coverage...');
      
      const { data: policy } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('policy_number', updatedClaimData.policy_number)
        .maybeSingle();

      if (policy) {
        const isCovered = policy.roadside_assistance && policy.towing_coverage;
        additionalData.is_covered = isCovered;
        additionalData.coverage_details = isCovered 
          ? `Coverage confirmed. Roadside assistance and towing included (up to ${policy.max_towing_distance} miles).${policy.rental_car_coverage ? ' Rental car coverage available.' : ''}`
          : 'Policy does not include roadside assistance coverage.';
        console.log('Coverage check result:', isCovered);
      } else {
        additionalData.is_covered = false;
        additionalData.coverage_details = 'Policy not found';
        console.log('Policy not found');
      }
    }

    // Check if we need to arrange services
    if (nextStatus === 'arranging_services' && structuredResponse.decisions.user_confirmed && claim.is_covered && (!claim.arranged_services || claim.arranged_services.length === 0)) {
      console.log('Arranging services...');
      
      // Find nearest garage for towing
      const { data: garages } = await supabase
        .from('garages')
        .select('*')
        .contains('services', ['tow'])
        .order('average_response_time', { ascending: true })
        .limit(1);

      const garage = garages?.[0];
      const arrangedServices = [];
      
      if (garage) {
        // Create tow service
        const { data: towService } = await supabase
          .from('services')
          .insert({
            claim_id: claimId,
            service_type: 'tow_truck',
            provider_name: garage.name,
            provider_phone: garage.phone,
            estimated_arrival: garage.average_response_time,
            status: 'dispatched'
          })
          .select()
          .single();

        arrangedServices.push(towService);
        additionalData.nearest_garage = garage.name;

        // Also arrange transportation
        const { data: transportProviders } = await supabase
          .from('garages')
          .select('*')
          .contains('services', ['taxi'])
          .order('average_response_time', { ascending: true })
          .limit(1);

        const transportProvider = transportProviders?.[0];
        
        if (transportProvider) {
          const { data: taxiService } = await supabase
            .from('services')
            .insert({
              claim_id: claimId,
              service_type: 'taxi',
              provider_name: transportProvider.name,
              provider_phone: transportProvider.phone,
              estimated_arrival: transportProvider.average_arrival_time,
              status: 'dispatched'
            })
            .select()
            .single();

          arrangedServices.push(taxiService);
        }

        additionalData.arranged_services = arrangedServices;
        nextStatus = 'notification_sent';
        console.log('Services arranged:', arrangedServices.length);
      }
    }

    // Update conversation history
    const updatedConversation = [
      ...conversationHistory,
      { 
        role: 'user', 
        content: userMessage,
        timestamp: new Date().toISOString()
      },
      { 
        role: 'assistant', 
        content: structuredResponse.message,
        timestamp: new Date().toISOString()
      }
    ];

    // Prepare database update
    const dbUpdateData: any = {
      ...updatedClaimData,
      status: nextStatus,
      conversation_history: updatedConversation,
    };

    // Add coverage and services data if available
    if (additionalData.is_covered !== undefined) {
      dbUpdateData.is_covered = additionalData.is_covered;
    }
    if (additionalData.coverage_details !== undefined) {
      dbUpdateData.coverage_details = additionalData.coverage_details;
    }
    if (additionalData.nearest_garage !== undefined) {
      dbUpdateData.nearest_garage = additionalData.nearest_garage;
    }
    if (additionalData.arranged_services !== undefined) {
      dbUpdateData.arranged_services = additionalData.arranged_services;
    }

    console.log('Updating database with status:', nextStatus);

    // Update claim in database
    const { error: updateError } = await supabase
      .from('claims')
      .update(dbUpdateData)
      .eq('id', claimId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to update claim');
    }

    console.log('Claim updated successfully');

    // Return clean response - all data in claimData
    return new Response(
      JSON.stringify({ 
        message: structuredResponse.message,
        status: nextStatus,
        claimData: { 
          id: claim.id,
          driver_name: updatedClaimData.driver_name,
          driver_phone: updatedClaimData.driver_phone,
          policy_number: updatedClaimData.policy_number,
          location: updatedClaimData.location,
          incident_description: updatedClaimData.incident_description,
          vehicle_make: updatedClaimData.vehicle_make,
          vehicle_model: updatedClaimData.vehicle_model,
          vehicle_year: updatedClaimData.vehicle_year,
          is_covered: additionalData.is_covered ?? claim.is_covered,
          coverage_details: additionalData.coverage_details ?? claim.coverage_details,
          arranged_services: additionalData.arranged_services ?? claim.arranged_services ?? [],
          nearest_garage: additionalData.nearest_garage ?? claim.nearest_garage,
          status: nextStatus,
          conversation_history: updatedConversation,
          created_at: claim.created_at,
          updated_at: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});