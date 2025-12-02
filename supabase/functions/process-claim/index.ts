import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional AI assistant for a car insurance roadside assistance service. Your role is to guide customers through a structured 5-stage claim process while being empathetic and efficient.

## Your Workflow

1. **Gather Information** - Collect these required details:
   - Policy number
   - Current location (where the incident occurred)
   - What happened (incident description)
   - Contact info (phone number OR email for notifications)
   - Optionally: driver name, vehicle details

2. **Confirm Details** - Once you have the required info, summarize it clearly and ask the user to confirm it's correct.

3. **Check Coverage** - After user confirms, use the check_coverage tool to verify their policy includes roadside assistance.

4. **Arrange Services** - If covered and user agrees, use the arrange_services tool to dispatch help (tow truck, transportation).

5. **Complete** - Confirm that services are on the way with provider names, phone numbers, and ETAs.

## Important Rules

- Be professional, empathetic, and reassuring - the user is likely stressed
- Extract information naturally from conversation - don't interrogate with a list of questions
- If user provides multiple pieces of info at once, acknowledge all of them
- Always ask for confirmation before checking coverage or dispatching services
- Use the save_claim_data tool to persist information as you collect it
- When services are arranged, clearly communicate ALL details (provider, phone, ETA)

## Response Style

Respond naturally in plain text. Be concise but warm. Use the tools to handle data operations.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claimId, userMessage, conversationHistory } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current claim data
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      throw new Error('Claim not found');
    }

    // Build context with current claim state
    const claimContext = `
## Current Claim State
- Claim ID: ${claim.id}
- Status: ${claim.status}
- Driver: ${claim.driver_name || 'Not provided'}
- Phone: ${claim.driver_phone || 'Not provided'}
- Email: ${claim.driver_email || 'Not provided'}
- Policy: ${claim.policy_number || 'Not provided'}
- Location: ${claim.location || 'Not provided'}
- Incident: ${claim.incident_description || 'Not provided'}
- Vehicle: ${[claim.vehicle_year, claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(' ') || 'Not provided'}
- Coverage Checked: ${claim.is_covered === null ? 'No' : claim.is_covered ? 'Yes - Covered' : 'Yes - Not Covered'}
${claim.coverage_details ? `- Coverage Details: ${claim.coverage_details}` : ''}
${claim.arranged_services?.length ? `- Services Arranged: ${claim.arranged_services.length} service(s)` : ''}`;

    // Define tools
    const tools = [
      {
        type: "function",
        function: {
          name: "save_claim_data",
          description: "Save collected information to the claim. Call this whenever the user provides new information.",
          parameters: {
            type: "object",
            properties: {
              driver_name: { type: "string", description: "Driver's full name" },
              driver_phone: { type: "string", description: "Driver's phone number" },
              driver_email: { type: "string", description: "Driver's email address" },
              policy_number: { type: "string", description: "Insurance policy number" },
              location: { type: "string", description: "Location where the incident occurred" },
              incident_description: { type: "string", description: "Description of what happened" },
              vehicle_make: { type: "string", description: "Vehicle manufacturer (e.g., Toyota)" },
              vehicle_model: { type: "string", description: "Vehicle model (e.g., Camry)" },
              vehicle_year: { type: "number", description: "Vehicle year" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_coverage",
          description: "Check if the policy covers roadside assistance. Only call after the user confirms their details are correct.",
          parameters: {
            type: "object",
            properties: {
              policy_number: { type: "string", description: "The policy number to check" }
            },
            required: ["policy_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "arrange_services",
          description: "Dispatch tow truck and transportation services. Only call after coverage is confirmed AND user agrees to proceed.",
          parameters: {
            type: "object",
            properties: {},
          }
        }
      },
      {
        type: "function",
        function: {
          name: "complete_claim",
          description: "Mark the claim as completed. Call this after services have been arranged and user is satisfied.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      }
    ];

    // Tool execution functions
    async function executeTool(name: string, args: any): Promise<string> {
      console.log(`Executing tool: ${name}`, args);

      switch (name) {
        case "save_claim_data": {
          const updateData: any = {};
          if (args.driver_name) updateData.driver_name = args.driver_name;
          if (args.driver_phone) updateData.driver_phone = args.driver_phone;
          if (args.driver_email) updateData.driver_email = args.driver_email;
          if (args.policy_number) updateData.policy_number = args.policy_number;
          if (args.location) updateData.location = args.location;
          if (args.incident_description) updateData.incident_description = args.incident_description;
          if (args.vehicle_make) updateData.vehicle_make = args.vehicle_make;
          if (args.vehicle_model) updateData.vehicle_model = args.vehicle_model;
          if (args.vehicle_year) updateData.vehicle_year = args.vehicle_year;

          await supabase.from('claims').update(updateData).eq('id', claimId);
          
          // Update local claim object
          Object.assign(claim, updateData);
          
          return JSON.stringify({ success: true, message: "Data saved successfully", saved: updateData });
        }

        case "check_coverage": {
          const { data: policy } = await supabase
            .from('insurance_policies')
            .select('*')
            .eq('policy_number', args.policy_number)
            .maybeSingle();

          if (!policy) {
            await supabase.from('claims').update({ 
              is_covered: false, 
              coverage_details: 'Policy not found in our system',
              status: 'coverage_check'
            }).eq('id', claimId);
            
            return JSON.stringify({ 
              covered: false, 
              reason: "Policy not found in our system. Please verify the policy number." 
            });
          }

          const isCovered = policy.roadside_assistance && policy.towing_coverage;
          const coverageDetails = isCovered 
            ? `Roadside assistance and towing included (up to ${policy.max_towing_distance} miles).${policy.rental_car_coverage ? ' Rental car coverage available.' : ''}`
            : 'This policy does not include roadside assistance coverage.';

          await supabase.from('claims').update({ 
            is_covered: isCovered, 
            coverage_details: coverageDetails,
            status: 'coverage_check'
          }).eq('id', claimId);

          return JSON.stringify({ 
            covered: isCovered, 
            details: coverageDetails,
            policy_holder: policy.holder_name,
            vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`
          });
        }

        case "arrange_services": {
          // Find tow truck provider
          const { data: towProviders } = await supabase
            .from('garages')
            .select('*')
            .contains('services', ['tow'])
            .order('average_response_time', { ascending: true })
            .limit(1);

          // Find transportation provider
          const { data: taxiProviders } = await supabase
            .from('garages')
            .select('*')
            .contains('services', ['taxi'])
            .order('average_response_time', { ascending: true })
            .limit(1);

          const arrangedServices: any[] = [];

          if (towProviders?.[0]) {
            const tow = towProviders[0];
            const { data: towService } = await supabase
              .from('services')
              .insert({
                claim_id: claimId,
                service_type: 'tow_truck',
                provider_name: tow.name,
                provider_phone: tow.phone,
                estimated_arrival: tow.average_response_time,
                status: 'dispatched'
              })
              .select()
              .single();
            
            if (towService) arrangedServices.push(towService);
          }

          if (taxiProviders?.[0]) {
            const taxi = taxiProviders[0];
            const { data: taxiService } = await supabase
              .from('services')
              .insert({
                claim_id: claimId,
                service_type: 'taxi',
                provider_name: taxi.name,
                provider_phone: taxi.phone,
                estimated_arrival: taxi.average_response_time,
                status: 'dispatched'
              })
              .select()
              .single();
            
            if (taxiService) arrangedServices.push(taxiService);
          }

          // Update claim with arranged services
          await supabase.from('claims').update({ 
            arranged_services: arrangedServices,
            status: 'arranging_services',
            nearest_garage: towProviders?.[0]?.name
          }).eq('id', claimId);

          // Create notifications
          const notificationMessage = `Services dispatched for your claim. ${arrangedServices.map(s => 
            `${s.service_type === 'tow_truck' ? 'Tow truck' : 'Transportation'}: ${s.provider_name} (ETA: ${s.estimated_arrival} min)`
          ).join('. ')}`;

          const notifications: any[] = [];
          if (claim.driver_phone) {
            notifications.push({
              claim_id: claimId,
              type: 'sms',
              recipient: claim.driver_phone,
              message: notificationMessage,
              status: 'pending'
            });
          }
          if (claim.driver_email) {
            notifications.push({
              claim_id: claimId,
              type: 'email',
              recipient: claim.driver_email,
              message: notificationMessage,
              status: 'pending'
            });
          }

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }

          return JSON.stringify({
            success: true,
            services: arrangedServices.map(s => ({
              type: s.service_type === 'tow_truck' ? 'Tow Truck' : 'Transportation',
              provider: s.provider_name,
              phone: s.provider_phone,
              eta_minutes: s.estimated_arrival
            })),
            notifications_sent: notifications.length
          });
        }

        case "complete_claim": {
          await supabase.from('claims').update({ status: 'completed' }).eq('id', claimId);
          return JSON.stringify({ success: true, message: "Claim marked as completed" });
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    }

    // Build messages for API call
    let messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n' + claimContext },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // Call OpenAI API
    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error('Failed to get AI response');
    }

    let data = await response.json();
    let choice = data.choices[0];

    // Handle tool calls in a loop
    while (choice.message.tool_calls?.length > 0) {
      console.log('Processing tool calls:', choice.message.tool_calls.length);
      
      // Add assistant message with tool calls
      messages.push(choice.message);

      // Execute each tool and add results
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        const result = await executeTool(toolCall.function.name, args);
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }

      // Get next response
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          tools,
          tool_choice: 'auto'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response after tool execution');
      }

      data = await response.json();
      choice = data.choices[0];
    }

    const assistantMessage = choice.message.content;

    // Get updated claim status
    const { data: updatedClaim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    // Save conversation history
    const updatedConversation = [
      ...conversationHistory,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
    ];

    await supabase
      .from('claims')
      .update({ conversation_history: updatedConversation })
      .eq('id', claimId);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        status: updatedClaim?.status || claim.status,
        claimData: {
          ...updatedClaim,
          conversation_history: updatedConversation
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
