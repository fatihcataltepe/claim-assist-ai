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

    // Use AI to extract structured information from the conversation
    const extractionPrompt = `Extract claim information from this conversation. Return ONLY valid JSON with these fields:
{
  "driver_name": "full name or empty string",
  "driver_phone": "phone number or empty string",
  "policy_number": "policy number or empty string",
  "location": "location description or empty string",
  "incident_description": "what happened or empty string",
  "vehicle_make": "car make or empty string",
  "vehicle_model": "car model or empty string",
  "vehicle_year": "year as number or null"
}

Conversation:
${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
User: ${userMessage}

Extract ALL information mentioned. If something wasn't mentioned, use empty string or null.`;

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

    console.log('Has minimum required info:', hasAllInfo);

    let nextStatus = claim.status;
    let additionalData: any = {};

    if (hasAllInfo && claim.status === 'data_gathering') {
      // Move to coverage check
      nextStatus = 'coverage_check';
      
      // Check coverage
      const { data: policy } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('policy_number', claim.policy_number)
        .single();

      if (policy) {
        const isCovered = policy.roadside_assistance && policy.towing_coverage;
        additionalData.is_covered = isCovered;
        additionalData.coverage_details = isCovered 
          ? `Coverage confirmed. Roadside assistance and towing included (up to ${policy.max_towing_distance} miles).${policy.rental_car_coverage ? ' Rental car coverage available.' : ''}`
          : 'Policy does not include roadside assistance coverage.';

        if (isCovered) {
          // Move to arranging services
          nextStatus = 'arranging_services';
          
          // Find nearest garage
          const { data: garages } = await supabase
            .from('garages')
            .select('*')
            .order('average_response_time', { ascending: true })
            .limit(1);

          const garage = garages?.[0];
          
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

            additionalData.nearest_garage = garage.name;
            additionalData.arranged_services = [towService];
            
            // Move to notification
            nextStatus = 'notification_sent';
          }
        }
      } else {
        additionalData.is_covered = false;
        additionalData.coverage_details = 'Policy not found';
      }
    }

    // Build AI response prompt
    const systemPrompt = `You are an AI insurance claims assistant helping drivers file claims quickly and efficiently.

Current status: ${nextStatus}
${additionalData.is_covered !== undefined ? `Coverage: ${additionalData.is_covered ? 'COVERED' : 'NOT COVERED'}` : ''}

CRITICAL: To initiate help, you ONLY need these 3 pieces of information:
1. Policy number
2. Location (where the incident occurred)
3. Incident description (what happened)

${hasAllInfo ? 'You have the minimum required information! Inform the user of the coverage status and arranged services.' : 'Gather the 3 essential pieces of information (policy number, location, incident description) to initiate help. Driver name and phone are helpful but not required to start service arrangement.'}

Be concise, professional, and focused on getting help to the driver as quickly as possible.`;

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

    // Update conversation history
    const updatedConversation = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    ];

    // Update claim in database
    await supabase
      .from('claims')
      .update({
        ...updatedClaimData,
        status: nextStatus,
        conversation_history: updatedConversation,
        ...additionalData,
      })
      .eq('id', claimId);

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        status: nextStatus,
        claimData: { 
          ...claim, 
          ...updatedClaimData,
          status: nextStatus,
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
