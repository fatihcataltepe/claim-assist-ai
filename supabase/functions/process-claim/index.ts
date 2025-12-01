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

    // Define the response tool
    const responseTool = {
      type: "function",
      function: {
        name: "generate_response",
        description: "Generate a structured response for the insurance claim conversation",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to display to the user"
            },
            extracted_data: {
              type: "object",
              properties: {
                driver_name: { type: "string" },
                driver_phone: { type: "string" },
                policy_number: { type: "string" },
                location: { type: "string" },
                incident_description: { type: "string" },
                vehicle_make: { type: "string" },
                vehicle_model: { type: "string" },
                vehicle_year: { type: "number" }
              },
              description: "Any new data extracted from the conversation. Only include fields that have values."
            },
            decisions: {
              type: "object",
              properties: {
                user_confirmed: {
                  type: "boolean",
                  description: "True if user is confirming/agreeing to proceed (yes, correct, confirm, etc.)"
                },
                needs_data_confirmation: {
                  type: "boolean",
                  description: "True if we have all required data but need user to confirm before proceeding"
                },
                needs_service_confirmation: {
                  type: "boolean",
                  description: "True if coverage check is complete and we need user to confirm service arrangement"
                }
              },
              required: ["user_confirmed"]
            },
            next_stage: {
              type: "string",
              enum: ["data_gathering", "coverage_check", "arranging_services", "notification_sent", "completed"],
              description: "The next stage the claim should move to"
            }
          },
          required: ["message", "extracted_data", "decisions", "next_stage"],
          additionalProperties: false
        }
      }
    };

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
        stageInstructions = `
You have all required information! Now:
1. Summarize what you collected
2. Ask user to confirm details are correct
3. Set needs_data_confirmation to true
4. Set next_stage to "coverage_check" ONLY if user_confirmed is true, otherwise stay at "data_gathering"`;
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
      stageInstructions = `
Services have been arranged:
${services.map((s: any) => `- ${s.service_type}: ${s.provider_name} (${s.provider_phone}) - ETA: ${s.estimated_arrival} min`).join('\n')}

Inform the user about ALL arranged services. Set next_stage to "notification_sent".`;
    }

    const systemPrompt = `You are an AI insurance claims assistant. Your job is to help drivers through the claims process.

${contextInfo}

${stageInstructions}

CRITICAL: Always use the generate_response tool with complete structured data. The UI relies on your structured response to update correctly.

Communication Style:
- Professional, clear, and reassuring
- Be explicit about stage transitions
- Ask for confirmations before major transitions`;

    // Get AI response with tool calling
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
        ],
        tools: [responseTool],
        tool_choice: { type: "function", function: { name: "generate_response" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const structuredResponse = JSON.parse(toolCall.function.arguments);
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
              estimated_arrival: transportProvider.average_response_time,
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