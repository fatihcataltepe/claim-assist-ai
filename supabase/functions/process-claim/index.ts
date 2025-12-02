import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional AI assistant for a car insurance roadside assistance service. Your role is to guide customers through a structured claim process while being empathetic and efficient.

## Your Workflow

1. **Gather Information** - You need to find necessary information seamlessly to initiate a claim.
  - Required information: policy_number, driver_name, driver_phone, driver_email, location, incident_description, vehicle_make, vehicle_model, vehicle_year
  - Ask for the policy number first, if they don't have it, ask for their phone number or full name.
  - Use find_policy_by_phone if they provide their phone number
  - Use find_policy_by_name if they provide their full name
  - These tools will search the insurance database and return matching policies
  - If multiple policies are found, ask the user to confirm which one is theirs
  - Use get_customer_by_policy to retrieve all customer information (name, phone, email, address, vehicle model, vehicle year, vehicle make)
  - This auto-fills customer data so you don't need to ask for details we already have
  - Greet the customer by name and confirm the details
  - Once confirmed, save all found information using save_claim_data, and move to the next step.


2. **Check Coverage** - Analyze the incident and determine what services the driver needs, then check if their policy covers it:
   - First, use get_policy_coverage to retrieve the policy's coverage details
   - Based on the incident description, determine what services the driver needs:
     * Towing: if the vehicle cannot be driven (breakdown, accident damage, flat tire that can't be fixed on-site)
     * Roadside assistance: for minor issues (jump start, lockout, fuel delivery, minor repairs)
     * Transport: if the driver needs immediate transportation from the incident location (taxi, rideshare)
     * Rental car: if the vehicle will be out of service for extended time and driver needs a temporary vehicle
   - Compare the needed services against the policy coverage
   - Use record_coverage_decision to save your analysis and decision
   - Clearly explain to the user what's covered and what's not, with specific details from their policy

3. **Arrange Services** - If covered and user agrees, use the arrange_services tool to dispatch help (tow truck, transportation).

4. **Complete** - Confirm that services are on the way with provider names, phone numbers, and ETAs.



## Important Rules

- Be professional, empathetic, and reassuring - the user is likely stressed
- Start by asking for the policy number, but offer to help look it up if they can't find it
- Extract information naturally from conversation - don't interrogate with a list of questions
- Ask one question at a time
- If user provides multiple pieces of info at once, acknowledge all of them
- Once a stage is complete, explicitly mentioned that to the user. (I have all the information, I checked your coverage and you are covered, I have arranged all the services now etc.)
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
          name: "get_customer_by_policy",
          description: "Retrieve customer information using their policy number. Call this IMMEDIATELY after getting the policy number to auto-fill customer details like name, phone, email, and address.",
          parameters: {
            type: "object",
            properties: {
              policy_number: { type: "string", description: "The insurance policy number" }
            },
            required: ["policy_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_policy_by_phone",
          description: "Search for insurance policies by the holder's phone number. Use this when the user doesn't have their policy number but knows their phone number on file.",
          parameters: {
            type: "object",
            properties: {
              phone_number: { type: "string", description: "The phone number to search for (the number registered with the insurance policy)" }
            },
            required: ["phone_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_policy_by_name",
          description: "Search for insurance policies by the holder's full name. Use this when the user doesn't have their policy number but provides their name.",
          parameters: {
            type: "object",
            properties: {
              holder_name: { type: "string", description: "The full name of the policy holder to search for" }
            },
            required: ["holder_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_policy_coverage",
          description: "Retrieve detailed coverage information for a policy. Returns what services are covered (towing, roadside assistance, rental car) and their limits. Use this to analyze if the driver's situation is covered.",
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
          name: "record_coverage_decision",
          description: "Record your coverage analysis and decision. Call this after analyzing the incident against the policy coverage to save the decision.",
          parameters: {
            type: "object",
            properties: {
              is_covered: { type: "boolean", description: "Whether the driver is covered for the services they need" },
              services_needed: { 
                type: "array", 
                items: { type: "string" },
                description: "List of services the driver needs based on the incident (e.g., 'towing', 'roadside_assistance', 'rental_car')" 
              },
              services_covered: { 
                type: "array", 
                items: { type: "string" },
                description: "List of needed services that ARE covered by the policy" 
              },
              services_not_covered: { 
                type: "array", 
                items: { type: "string" },
                description: "List of needed services that are NOT covered by the policy" 
              },
              coverage_explanation: { type: "string", description: "Brief explanation of the coverage decision for the user" }
            },
            required: ["is_covered", "services_needed", "coverage_explanation"]
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

        case "get_customer_by_policy": {
          // First, get the policy to find its ID
          const { data: policy, error: policyError } = await supabase
            .from('insurance_policies')
            .select('id, policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model')
            .eq('policy_number', args.policy_number)
            .maybeSingle();

          if (policyError || !policy) {
            return JSON.stringify({ 
              found: false, 
              error: "Policy not found. Please verify the policy number." 
            });
          }

          // Now search for customer with this policy ID in their policy_ids array
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .contains('policy_ids', [policy.id]);

          if (customerError) {
            console.error('Error searching customers:', customerError);
            // Fall back to policy holder info
            return JSON.stringify({
              found: true,
              source: 'policy',
              customer: {
                full_name: policy.holder_name,
                phone: policy.holder_phone,
                email: policy.holder_email,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`
              },
              message: `Found policy holder: ${policy.holder_name}. Phone: ${policy.holder_phone}.`
            });
          }

          if (!customers || customers.length === 0) {
            // No customer record, use policy holder info
            return JSON.stringify({
              found: true,
              source: 'policy',
              customer: {
                full_name: policy.holder_name,
                phone: policy.holder_phone,
                email: policy.holder_email,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`
              },
              message: `Found policy holder: ${policy.holder_name}. Phone: ${policy.holder_phone}.`
            });
          }

          const customer = customers[0];
          return JSON.stringify({
            found: true,
            source: 'customer_record',
            customer: {
              full_name: customer.full_name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              date_of_birth: customer.date_of_birth,
              licence_number: customer.licence_number,
              licence_issuer: customer.licence_issuer,
              customer_since: customer.customer_since
            },
            policy: {
              policy_number: policy.policy_number,
              vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`
            },
            message: `Found customer: ${customer.full_name}. Phone: ${customer.phone}. Email: ${customer.email}.`
          });
        }

        case "find_policy_by_phone": {
          const { data: policies, error } = await supabase
            .from('insurance_policies')
            .select('policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model, coverage_type')
            .eq('holder_phone', args.phone_number);

          if (error) {
            console.error('Error searching policies by phone:', error);
            return JSON.stringify({ 
              found: false, 
              error: "An error occurred while searching. Please try again." 
            });
          }

          if (!policies || policies.length === 0) {
            return JSON.stringify({ 
              found: false, 
              message: "No policies found with that phone number. Please double-check the number or try searching by name." 
            });
          }

          if (policies.length === 1) {
            const policy = policies[0];
            return JSON.stringify({ 
              found: true, 
              single_match: true,
              policy: {
                policy_number: policy.policy_number,
                holder_name: policy.holder_name,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`,
                coverage_type: policy.coverage_type
              },
              message: `Found policy ${policy.policy_number} for ${policy.holder_name}. Vehicle: ${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}.`
            });
          }

          // Multiple policies found
          return JSON.stringify({ 
            found: true, 
            single_match: false,
            policies: policies.map(p => ({
              policy_number: p.policy_number,
              holder_name: p.holder_name,
              vehicle: `${p.vehicle_year} ${p.vehicle_make} ${p.vehicle_model}`,
              coverage_type: p.coverage_type
            })),
            message: `Found ${policies.length} policies. Please confirm which one is yours.`
          });
        }

        case "find_policy_by_name": {
          // Use ilike for case-insensitive partial matching
          const { data: policies, error } = await supabase
            .from('insurance_policies')
            .select('policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model, coverage_type')
            .ilike('holder_name', `%${args.holder_name}%`);

          if (error) {
            console.error('Error searching policies by name:', error);
            return JSON.stringify({ 
              found: false, 
              error: "An error occurred while searching. Please try again." 
            });
          }

          if (!policies || policies.length === 0) {
            return JSON.stringify({ 
              found: false, 
              message: "No policies found with that name. Please check the spelling or try searching by phone number." 
            });
          }

          if (policies.length === 1) {
            const policy = policies[0];
            return JSON.stringify({ 
              found: true, 
              single_match: true,
              policy: {
                policy_number: policy.policy_number,
                holder_name: policy.holder_name,
                phone_on_file: policy.holder_phone,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`,
                coverage_type: policy.coverage_type
              },
              message: `Found policy ${policy.policy_number} for ${policy.holder_name}. Vehicle: ${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}.`
            });
          }

          // Multiple policies found
          return JSON.stringify({ 
            found: true, 
            single_match: false,
            policies: policies.map(p => ({
              policy_number: p.policy_number,
              holder_name: p.holder_name,
              vehicle: `${p.vehicle_year} ${p.vehicle_make} ${p.vehicle_model}`,
              coverage_type: p.coverage_type
            })),
            message: `Found ${policies.length} policies matching that name. Please confirm which one is yours.`
          });
        }

        case "get_policy_coverage": {
          const { data: policy } = await supabase
            .from('insurance_policies')
            .select('*')
            .eq('policy_number', args.policy_number)
            .maybeSingle();

          if (!policy) {
            return JSON.stringify({ 
              found: false, 
              error: "Policy not found in our system. Please verify the policy number." 
            });
          }

          // Return all coverage details for AI to analyze
          return JSON.stringify({ 
            found: true,
            policy_number: policy.policy_number,
            coverage_type: policy.coverage_type,
            coverage_details: {
              roadside_assistance: policy.roadside_assistance || false,
              towing_coverage: policy.towing_coverage || false,
              max_towing_distance: policy.max_towing_distance || 0,
              transport_coverage: policy.transport_coverage || false,
              rental_car_coverage: policy.rental_car_coverage || false
            },
            policy_holder: policy.holder_name,
            vehicle: {
              year: policy.vehicle_year,
              make: policy.vehicle_make,
              model: policy.vehicle_model
            },
            message: "Policy coverage details retrieved. Analyze the incident to determine if the driver's needs are covered."
          });
        }

        case "record_coverage_decision": {
          // Update the claim with the AI's coverage decision
          await supabase.from('claims').update({ 
            is_covered: args.is_covered, 
            coverage_details: JSON.stringify({
              services_needed: args.services_needed,
              services_covered: args.services_covered || [],
              services_not_covered: args.services_not_covered || [],
              explanation: args.coverage_explanation
            }),
            status: 'coverage_check'
          }).eq('id', claimId);

          return JSON.stringify({ 
            success: true,
            is_covered: args.is_covered,
            services_needed: args.services_needed,
            services_covered: args.services_covered || [],
            services_not_covered: args.services_not_covered || [],
            message: args.coverage_explanation
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
            const { data: towService, error: towError } = await supabase
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
            
            if (towError) {
              console.error('Error inserting tow service:', towError);
            } else if (towService) {
              arrangedServices.push(towService);
            }
          }

          if (taxiProviders?.[0]) {
            const taxi = taxiProviders[0];
            const { data: taxiService, error: taxiError } = await supabase
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
            
            if (taxiError) {
              console.error('Error inserting taxi service:', taxiError);
            } else if (taxiService) {
              arrangedServices.push(taxiService);
            }
          }

          // Check if any services were actually arranged
          if (arrangedServices.length === 0) {
            return JSON.stringify({
              success: false,
              error: "Failed to arrange services. No service providers available or database error occurred."
            });
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

    // Handle case where content might be null (happens during tool calls)
    const assistantMessage = choice.message.content || "I've processed your request. Is there anything else you need help with?";

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
