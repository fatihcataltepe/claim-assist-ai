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

    // Use AI to extract structured information and detect confirmation
    const extractionPrompt = `Analyze this conversation and return ONLY valid JSON with these fields:
{
  "driver_name": "full name or empty string",
  "driver_phone": "phone number or empty string",
  "policy_number": "policy number or empty string",
  "location": "location description or empty string",
  "incident_description": "what happened or empty string",
  "vehicle_make": "car make or empty string",
  "vehicle_model": "car model or empty string",
  "vehicle_year": "year as number or null",
  "user_confirmed": true if user is confirming/agreeing to proceed, false otherwise
}

Conversation:
${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
User: ${userMessage}

Extract ALL information mentioned. Detect if user is confirming/agreeing (yes, correct, proceed, confirm, etc.).`;

    const extractionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: extractionPrompt }
        ],
      }),
    });

    if (!extractionResponse.ok) {
      console.error('Extraction AI error:', extractionResponse.status);
      throw new Error('Failed to extract information');
    }

    const extractionData = await extractionResponse.json();
    const extractedText = extractionData.choices[0].message.content;
    
    // Parse JSON from AI response
    let extractedInfo: any = {};
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedInfo = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse extraction:', e);
    }

    // Merge extracted info with existing claim data
    const updatedClaimData = {
      driver_name: extractedInfo.driver_name || claim.driver_name,
      driver_phone: extractedInfo.driver_phone || claim.driver_phone,
      policy_number: extractedInfo.policy_number || claim.policy_number,
      location: extractedInfo.location || claim.location,
      incident_description: extractedInfo.incident_description || claim.incident_description,
      vehicle_make: extractedInfo.vehicle_make || claim.vehicle_make,
      vehicle_model: extractedInfo.vehicle_model || claim.vehicle_model,
      vehicle_year: extractedInfo.vehicle_year || claim.vehicle_year,
    };

    console.log('Extracted info:', extractedInfo);
    console.log('Updated claim data:', updatedClaimData);

    // Check if we have all MINIMUM required information to initiate help
    const hasAllInfo = !!(
      updatedClaimData.policy_number &&
      updatedClaimData.location &&
      updatedClaimData.incident_description
    );

    const userConfirmed = extractedInfo.user_confirmed === true;
    console.log('Has minimum required info:', hasAllInfo);
    console.log('User confirmed:', userConfirmed);

    let nextStatus = claim.status;
    let additionalData: any = {};

    // Stage 1: Data gathering - waiting for minimum info
    if (claim.status === 'data_gathering' && hasAllInfo && !claim.is_covered) {
      // We have minimum info, but need user to confirm before checking coverage
      // AI will be prompted to ask for confirmation
      additionalData.awaiting_data_confirmation = true;
    }

    // Stage 2: User confirmed data - now check coverage
    if (claim.status === 'data_gathering' && hasAllInfo && userConfirmed) {
      nextStatus = 'coverage_check';
      
      // Check coverage
      const { data: policy } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('policy_number', updatedClaimData.policy_number)
        .single();

      if (policy) {
        const isCovered = policy.roadside_assistance && policy.towing_coverage;
        additionalData.is_covered = isCovered;
        additionalData.coverage_details = isCovered 
          ? `Coverage confirmed. Roadside assistance and towing included (up to ${policy.max_towing_distance} miles).${policy.rental_car_coverage ? ' Rental car coverage available.' : ''}`
          : 'Policy does not include roadside assistance coverage.';
        additionalData.awaiting_service_confirmation = isCovered; // Only ask if covered
      } else {
        additionalData.is_covered = false;
        additionalData.coverage_details = 'Policy not found';
      }
    }

    // Stage 3: User confirmed to proceed with service arrangement
    if (claim.status === 'coverage_check' && claim.is_covered && userConfirmed) {
      nextStatus = 'arranging_services';
      
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

        // Also arrange transportation for the driver (taxi service)
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
        
        // Move to notification
        nextStatus = 'notification_sent';
      }
    }

    // Build AI response prompt with stage-specific guidance
    let stageGuidance = '';
    
    if (claim.status === 'data_gathering' && !hasAllInfo) {
      stageGuidance = `STAGE: Data Gathering
You are currently collecting information. You need these 3 essential pieces:
1. Policy number
2. Location (where the incident occurred)
3. Incident description (what happened)

Continue gathering this information naturally through conversation.`;
    } else if (claim.status === 'data_gathering' && hasAllInfo && additionalData.awaiting_data_confirmation) {
      stageGuidance = `STAGE: Data Gathering Complete - AWAITING CONFIRMATION
You have collected all required information:
- Policy Number: ${updatedClaimData.policy_number}
- Location: ${updatedClaimData.location}
- Incident: ${updatedClaimData.incident_description}
${updatedClaimData.vehicle_make ? `- Vehicle: ${updatedClaimData.vehicle_make} ${updatedClaimData.vehicle_model || ''}` : ''}

YOUR RESPONSE MUST:
1. Clearly state "I have all the information needed now."
2. Summarize the key details you collected
3. Ask the user to confirm these details are correct before proceeding
4. Wait for their confirmation

Be clear that this completes the "Gathering Information" stage.`;
    } else if (claim.status === 'coverage_check' && additionalData.is_covered !== undefined) {
      const coverageReason = additionalData.is_covered 
        ? additionalData.coverage_details
        : additionalData.coverage_details;
      
      stageGuidance = `STAGE: Coverage Check Complete - AWAITING SERVICE CONFIRMATION
Coverage Status: ${additionalData.is_covered ? '✅ COVERED' : '❌ NOT COVERED'}
Details: ${coverageReason}

YOUR RESPONSE MUST:
1. Explicitly state the coverage decision: "${additionalData.is_covered ? 'You are covered in this case' : 'Unfortunately, you are not covered in this case'}"
2. Explain the reason: ${coverageReason}
3. ${additionalData.is_covered ? 'Ask if they want to proceed with arranging services' : 'Explain what they can do next'}
4. Wait for their response

Be clear that the "Checking Coverage" stage is complete.`;
    } else if (claim.status === 'arranging_services' || nextStatus === 'notification_sent') {
      const services = additionalData.arranged_services || [];
      const towService = services.find((s: any) => s.service_type === 'tow_truck');
      const taxiService = services.find((s: any) => s.service_type === 'taxi');
      
      stageGuidance = `STAGE: Services Arranged - COMPLETE
Service Details:
${towService ? `
- Tow Truck Service
  Provider: ${towService.provider_name}
  Phone: ${towService.provider_phone}
  Estimated Arrival: ${towService.estimated_arrival} minutes
` : ''}
${taxiService ? `
- Transportation Service (Taxi)
  Provider: ${taxiService.provider_name}
  Phone: ${taxiService.provider_phone}
  Estimated Arrival: ${taxiService.estimated_arrival} minutes
` : ''}

YOUR RESPONSE MUST:
1. Confirm services have been arranged
2. Provide ALL service details (provider names, contact numbers, estimated arrivals)
3. Tell them a tow truck AND transportation (taxi) are both on the way
4. Tell them what to expect next
5. Confirm the "Arranging Services" stage is complete

Be clear and provide complete contact information for both services.`;
    }

    const systemPrompt = `You are an AI insurance claims assistant helping drivers file claims with clear checkpoints at each stage.

Current Status: ${nextStatus}
${additionalData.is_covered !== undefined ? `Coverage: ${additionalData.is_covered ? 'COVERED' : 'NOT COVERED'}` : ''}

${stageGuidance}

Communication Style:
- Professional, clear, and reassuring
- Explicitly mark stage completions
- Ask for confirmation before major transitions
- Provide complete information at each checkpoint

IMPORTANT: Follow the stage guidance exactly. Ask for confirmations and wait for user responses.`;

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
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    // Update conversation history with timestamps
    const updatedConversation = [
      ...conversationHistory,
      { 
        role: 'user', 
        content: userMessage,
        timestamp: new Date().toISOString()
      },
      { 
        role: 'assistant', 
        content: assistantMessage,
        timestamp: new Date().toISOString()
      }
    ];

    console.log('Saving conversation with', updatedConversation.length, 'messages');

    // Prepare data for database update - exclude temporary flags
    const dbUpdateData: any = {
      ...updatedClaimData,
      status: nextStatus,
      conversation_history: updatedConversation,
    };

    // Add only database columns from additionalData (exclude awaiting_* flags)
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

    // Update claim in database
    const { error: updateError } = await supabase
      .from('claims')
      .update(dbUpdateData)
      .eq('id', claimId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to update claim');
    }

    console.log('Claim updated successfully with', updatedConversation.length, 'messages');

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        status: nextStatus,
        claimData: { 
          ...claim, 
          ...updatedClaimData,
          status: nextStatus,
          conversation_history: updatedConversation,
          ...additionalData 
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
