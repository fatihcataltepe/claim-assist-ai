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

    // Build AI context
    const systemPrompt = `You are an AI insurance claims assistant. Your role is to:
1. Gather necessary information from the driver (name, phone, policy number, location, vehicle details, incident description)
2. Check coverage against policy data
3. Arrange appropriate services (tow truck, repair, taxi/rental car)
4. Keep responses concise and professional

Current claim status: ${claim.status}
Collected information: ${JSON.stringify(claim)}

Ask follow-up questions ONLY if critical information is missing. Be efficient and helpful.`;

    // Call Lovable AI
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

    // Extract information from conversation
    const infoExtracted = extractClaimInfo(userMessage, claim);
    
    // Update claim with new information
    const updatedConversation = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    ];

    await supabase
      .from('claims')
      .update({
        ...infoExtracted,
        conversation_history: updatedConversation,
      })
      .eq('id', claimId);

    // Determine next status
    let nextStatus = claim.status;
    let additionalData = {};

    if (isInfoComplete(claim, infoExtracted)) {
      // Check coverage
      nextStatus = 'coverage_check';
      const coverageResult = await checkCoverage(supabase, claim, infoExtracted);
      additionalData = coverageResult;
      
      if (coverageResult.is_covered) {
        // Arrange services
        nextStatus = 'arranging_services';
        const services = await arrangeServices(supabase, claimId, claim, infoExtracted);
        additionalData = { ...coverageResult, arranged_services: services };
      }
    }

    // Update status if changed
    if (nextStatus !== claim.status) {
      await supabase
        .from('claims')
        .update({ 
          status: nextStatus,
          ...additionalData
        })
        .eq('id', claimId);
    }

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        status: nextStatus,
        claimData: { ...claim, ...infoExtracted, ...additionalData }
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

function extractClaimInfo(message: string, currentClaim: any) {
  const updates: any = {};
  const lowerMessage = message.toLowerCase();

  // Extract policy number
  const policyMatch = message.match(/POL-\d{4}-\d{3}/i);
  if (policyMatch) updates.policy_number = policyMatch[0];

  // Extract phone numbers
  const phoneMatch = message.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) updates.driver_phone = phoneMatch[0];

  // Extract location patterns
  if (lowerMessage.includes('at ') || lowerMessage.includes('on ') || lowerMessage.includes('near ')) {
    const locationMatch = message.match(/(?:at|on|near)\s+([^,.!?]+)/i);
    if (locationMatch) updates.location = locationMatch[1].trim();
  }

  return updates;
}

function isInfoComplete(claim: any, newInfo: any) {
  const combined = { ...claim, ...newInfo };
  return !!(
    combined.driver_name &&
    combined.driver_phone &&
    combined.policy_number &&
    combined.location &&
    combined.incident_description
  );
}

async function checkCoverage(supabase: any, claim: any, newInfo: any) {
  const policyNumber = newInfo.policy_number || claim.policy_number;
  
  const { data: policy } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('policy_number', policyNumber)
    .single();

  if (!policy) {
    return {
      is_covered: false,
      coverage_details: 'Policy not found'
    };
  }

  const isCovered = policy.roadside_assistance && policy.towing_coverage;
  
  return {
    is_covered: isCovered,
    coverage_details: isCovered 
      ? `Coverage confirmed. Roadside assistance and towing included (up to ${policy.max_towing_distance} miles).${policy.rental_car_coverage ? ' Rental car coverage available.' : ''}`
      : 'Policy does not include roadside assistance coverage.'
  };
}

async function arrangeServices(supabase: any, claimId: string, claim: any, newInfo: any) {
  // Find nearest garage
  const { data: garages } = await supabase
    .from('garages')
    .select('*')
    .order('average_response_time', { ascending: true })
    .limit(1);

  const garage = garages?.[0];
  
  if (!garage) {
    return [];
  }

  const services = [];

  // Arrange tow truck
  const towService = {
    claim_id: claimId,
    service_type: 'tow_truck',
    provider_name: garage.name,
    provider_phone: garage.phone,
    estimated_arrival: garage.average_response_time,
    status: 'dispatched'
  };

  const { data: tow } = await supabase
    .from('services')
    .insert(towService)
    .select()
    .single();

  services.push(tow);

  // Update claim
  await supabase
    .from('claims')
    .update({
      nearest_garage: garage.name,
      arranged_services: services
    })
    .eq('id', claimId);

  return services;
}
