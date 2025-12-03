import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a professional AI assistant for a car insurance roadside assistance service. Your role is to guide customers through a structured claim process while being empathetic and efficient.

## Your Workflow

1. **Gather Information** - You need to find necessary information seamlessly to initiate a claim.
  - Required information: policy_number, driver_name, driver_phone, driver_email, location, incident_description, vehicle_make, vehicle_model, vehicle_year
  - Ask for the policy number first
  - If they don't have their policy number:
    * Ask for their phone number OR their full name (one or the other, not both)
    * IMMEDIATELY call find_policy_by_phone if they provide a phone number
    * IMMEDIATELY call find_policy_by_name if they provide their full name
    * DO NOT ask for date of birth - use the tools above to search
  - These tools search the insurance_policies table by phone or name and return matching policies
  - If multiple policies are found, ask the user to confirm which one is theirs
  - Once you have the policy_number, use get_customer_by_policy to retrieve all customer information (name, phone, email, address, vehicle)
  - This auto-fills customer data - DO NOT ask for information you already retrieved (name, phone, email, vehicle make/model/year)
  - Save the retrieved info immediately using save_claim_data
  - Only ask for: location and incident_description (the only fields you don't have from the policy lookup)
  - **MANDATORY**: Once you have all required information, communicate that you've gathered everything needed and ask the user to confirm the details before proceeding to coverage assessment. Use your own words, but make it clear you're ready to move to the next stage. Wait for user confirmation before checking coverage.

2. **Check Coverage** - Analyze the incident and determine what services the driver needs, then check if their policy covers it:
   - **MANDATORY**: First, use get_policy_coverage to retrieve the policy's coverage details
   - Based on the incident description, determine what services the driver needs:
     * **repair_truck (roadside assistance)**: for issues that can be fixed on-site (jump start, lockout, fuel delivery, flat tire repair, minor repairs). After repair, the vehicle can be driven normally.
     * **tow_truck**: ONLY if the vehicle cannot be driven and needs to be towed to a repair shop (major breakdown, accident damage, flat tire that can't be fixed on-site)
     * **taxi**: ONLY if the driver needs immediate transportation FROM the incident location AND the vehicle cannot be driven (e.g., waiting for tow, vehicle undrivable)
     * **rental_car**: ONLY if the vehicle will be out of service for extended time (days/weeks) and driver needs a temporary vehicle
   - Compare the needed services against the policy coverage
   - **MANDATORY**: Use record_coverage_decision to save your analysis and decision
   - **MANDATORY**: After checking coverage, communicate the result clearly in your own words:
     * If covered: State that they're covered, explain what's covered, and ask if they want to proceed with arranging services. Wait for user confirmation before arranging services.
     * If NOT covered: Explain why they're not covered with specific details. Then ask: "Would you like to speak with a real agent who may be able to help you further?" This is an escalation option for uncovered claims. If user understands and agrees, ask them to complete the claim.

3. **Arrange Services** - If covered and user agrees to proceed:
   - **IMPORTANT**: Only arrange the services that are actually needed based on the incident (follow the service selection rules above)
   - First, use get_available_providers to see what service providers are available for each needed service type
   - Choose the best provider for each service, never ask to the user which one they prefer.
   - Call arrange_services with:
     * services_to_arrange: array of services with service_type (tow_truck, repair_truck, taxi, rental_car) and optionally provider_id
     * notification_message: a friendly summary message for the customer (this gets sent via SMS/email)
   - The tool will create entries in the services table (read by service dispatch system) and notifications table (read by notification service)
   - **MANDATORY**: After arranging services, communicate in your own words that you've arranged the services with as much detail, mention that they'll receive notifications via phone or email, and ask if there's anything else you can help with before completing the claim.
   - If the user confirms they're satisfied, IMMEDIATELY use the complete_claim tool to mark the claim as completed
   - Do NOT end the conversation without completing the claim if the user indicates they're done


## Available Tools
- save_claim_data: Save collected information to the claim
- get_customer_by_policy: Get customer info using policy_number
- find_policy_by_phone: Search policies by phone number
- find_policy_by_name: Search policies by holder name
- get_policy_coverage: Check what services are covered by the policy
- record_coverage_decision: Record your coverage analysis and decision
- get_available_providers: Get list of available service providers by type (tow_truck, repair_truck, taxi, rental_car)
- arrange_services: Create service requests and notifications for dispatch
- complete_claim: Mark claim as complete

DO NOT try to use any other tools. There is no "get_customer_details" tool.

## Important Rules
- Be professional, empathetic, and reassuring - the user is likely stressed
- Start by asking for the policy number, but offer to help look it up if they can't find it
- Extract information naturally from conversation - don't interrogate with a list of questions
- Ask one question at a time. If user provides multiple pieces of info at once, acknowledge all of them- 
- Always communicate stage completion transparently before moving to the next stage (see mandatory communication points in workflow)
- Use the save_claim_data tool to persist information as you collect it
- When services are arranged, clearly communicate ALL details (provider, phone, ETA)
- **CRITICAL**: Only arrange services that match the actual incident need. Do NOT arrange unnecessary services (e.g., do NOT arrange taxi for jump-start since vehicle will be drivable after)
- **CRITICAL**: After arranging services, you MUST ask about completion and use complete_claim tool when user confirms they're done. Do NOT leave claims incomplete.
- **CRITICAL**: Every message you send MUST end with a question or actionable prompt. Never send messages that just state what you're doing without giving the user a way to respond or proceed. 
  * BAD: "I am now checking your coverage details." (user has to ask what's next)
  * GOOD: "I'm checking your coverage details. Would you like me to proceed with the coverage check?" OR "I've checked your coverage and you're covered for roadside assistance. Would you like me to arrange services now?"
  * BAD: "I have all the information." (dead end - user doesn't know what to do)
  * GOOD: "I have all the information I need. Would you like me to check your coverage now?"
  * Always either: (1) Ask for permission before taking action, (2) State the result and ask what's next, or (3) Ask for additional information needed

## Response Style

Respond naturally in plain text. Be concise but warm. Use the tools to handle data operations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claimId, userMessage, conversationHistory } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current claim data
    const { data: claim, error: claimError } = await supabase.from("claims").select("*").eq("id", claimId).single();

    if (claimError || !claim) {
      throw new Error("Claim not found");
    }

    // Build context with current claim state
    const claimContext = `
## Current Claim State
- Claim ID: ${claim.id}
- Status: ${claim.status}
- Driver: ${claim.driver_name || "Not provided"}
- Phone: ${claim.driver_phone || "Not provided"}
- Email: ${claim.driver_email || "Not provided"}
- Policy: ${claim.policy_number || "Not provided"}
- Location: ${claim.location || "Not provided"}
- Incident: ${claim.incident_description || "Not provided"}
- Vehicle: ${[claim.vehicle_year, claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(" ") || "Not provided"}
- Coverage Checked: ${claim.is_covered === null ? "No" : claim.is_covered ? "Yes - Covered" : "Yes - Not Covered"}
${claim.coverage_details ? `- Coverage Details: ${claim.coverage_details}` : ""}
${claim.arranged_services?.length ? `- Services Arranged: ${claim.arranged_services.length} service(s)` : ""}`;

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
              vehicle_year: { type: "number", description: "Vehicle year" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_customer_by_policy",
          description:
            "Retrieve customer information using their policy number. Call this IMMEDIATELY after getting the policy number to auto-fill customer details like name, phone, email, and address.",
          parameters: {
            type: "object",
            properties: {
              policy_number: { type: "string", description: "The insurance policy number" },
            },
            required: ["policy_number"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "find_policy_by_phone",
          description:
            "Search for insurance policies by the holder's phone number. Use this when the user doesn't have their policy number but knows their phone number on file.",
          parameters: {
            type: "object",
            properties: {
              phone_number: {
                type: "string",
                description: "The phone number to search for (the number registered with the insurance policy)",
              },
            },
            required: ["phone_number"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "find_policy_by_name",
          description:
            "Search for insurance policies by the holder's full name. Use this when the user doesn't have their policy number but provides their name.",
          parameters: {
            type: "object",
            properties: {
              holder_name: { type: "string", description: "The full name of the policy holder to search for" },
            },
            required: ["holder_name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_policy_coverage",
          description:
            "Retrieve detailed coverage information for a policy. Returns what services are covered (towing, roadside assistance, rental car) and their limits. Use this to analyze if the driver's situation is covered.",
          parameters: {
            type: "object",
            properties: {
              policy_number: { type: "string", description: "The policy number to check" },
            },
            required: ["policy_number"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "record_coverage_decision",
          description:
            "Record your coverage analysis and decision. Call this after analyzing the incident against the policy coverage to save the decision.",
          parameters: {
            type: "object",
            properties: {
              is_covered: { type: "boolean", description: "Whether the driver is covered for the services they need" },
              services_needed: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of services the driver needs based on the incident (e.g., 'towing', 'roadside_assistance', 'rental_car')",
              },
              services_covered: {
                type: "array",
                items: { type: "string" },
                description: "List of needed services that ARE covered by the policy",
              },
              services_not_covered: {
                type: "array",
                items: { type: "string" },
                description: "List of needed services that are NOT covered by the policy",
              },
              coverage_explanation: {
                type: "string",
                description: "Brief explanation of the coverage decision for the user",
              },
            },
            required: ["is_covered", "services_needed", "coverage_explanation"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_available_providers",
          description:
            "Get a list of all available service providers from the database. Call this to see what providers are available before arranging services.",
          parameters: {
            type: "object",
            properties: {
              service_type: {
                type: "string",
                enum: ["tow_truck", "repair_truck", "taxi", "rental_car"],
                description: "The type of service to find providers for",
              },
            },
            required: ["service_type"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "arrange_services",
          description:
            "Arrange specific services by selecting providers for each service type needed. Call this after coverage is confirmed AND user agrees to proceed.",
          parameters: {
            type: "object",
            properties: {
              services_to_arrange: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    service_type: {
                      type: "string",
                      enum: ["tow_truck", "repair_truck", "taxi", "rental_car"],
                      description: "The type of service to arrange",
                    },
                    provider_id: {
                      type: "string",
                      description:
                        "The ID of the chosen provider from the garages table (optional - if not provided, best available will be selected)",
                    },
                  },
                  required: ["service_type"],
                },
                description: "List of services to arrange with optional provider selection",
              },
              notification_message: {
                type: "string",
                description: "A summary message to send to the customer about the arranged services",
              },
            },
            required: ["services_to_arrange", "notification_message"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "complete_claim",
          description:
            "Mark the claim as completed. Call this after services have been arranged and user is satisfied.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
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

          await supabase.from("claims").update(updateData).eq("id", claimId);

          // Update local claim object
          Object.assign(claim, updateData);

          return JSON.stringify({ success: true, message: "Data saved successfully", saved: updateData });
        }

        case "get_customer_by_policy": {
          // First, get the policy to find its ID
          const { data: policy, error: policyError } = await supabase
            .from("insurance_policies")
            .select(
              "id, policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model",
            )
            .eq("policy_number", args.policy_number)
            .maybeSingle();

          if (policyError || !policy) {
            return JSON.stringify({
              found: false,
              error: "Policy not found. Please verify the policy number.",
            });
          }

          // Now search for customer with this policy ID in their policy_ids array
          const { data: customers, error: customerError } = await supabase
            .from("customers")
            .select("*")
            .contains("policy_ids", [policy.id]);

          if (customerError) {
            console.error("Error searching customers:", customerError);
            // Fall back to policy holder info
            return JSON.stringify({
              found: true,
              source: "policy",
              customer: {
                full_name: policy.holder_name,
                phone: policy.holder_phone,
                email: policy.holder_email,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`,
              },
              message: `Found policy holder: ${policy.holder_name}. Phone: ${policy.holder_phone}.`,
            });
          }

          if (!customers || customers.length === 0) {
            // No customer record, use policy holder info
            return JSON.stringify({
              found: true,
              source: "policy",
              customer: {
                full_name: policy.holder_name,
                phone: policy.holder_phone,
                email: policy.holder_email,
                vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`,
              },
              message: `Found policy holder: ${policy.holder_name}. Phone: ${policy.holder_phone}.`,
            });
          }

          const customer = customers[0];
          return JSON.stringify({
            found: true,
            source: "customer_record",
            customer: {
              full_name: customer.full_name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              date_of_birth: customer.date_of_birth,
              licence_number: customer.licence_number,
              licence_issuer: customer.licence_issuer,
              customer_since: customer.customer_since,
            },
            policy: {
              policy_number: policy.policy_number,
              vehicle: `${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}`,
            },
            message: `Found customer: ${customer.full_name}. Phone: ${customer.phone}. Email: ${customer.email}.`,
          });
        }

        case "find_policy_by_phone": {
          const { data: policies, error } = await supabase
            .from("insurance_policies")
            .select(
              "policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model, coverage_type",
            )
            .eq("holder_phone", args.phone_number);

          if (error) {
            console.error("Error searching policies by phone:", error);
            return JSON.stringify({
              found: false,
              error: "An error occurred while searching. Please try again.",
            });
          }

          if (!policies || policies.length === 0) {
            return JSON.stringify({
              found: false,
              message:
                "No policies found with that phone number. Please double-check the number or try searching by name.",
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
                coverage_type: policy.coverage_type,
              },
              message: `Found policy ${policy.policy_number} for ${policy.holder_name}. Vehicle: ${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}.`,
            });
          }

          // Multiple policies found
          return JSON.stringify({
            found: true,
            single_match: false,
            policies: policies.map((p) => ({
              policy_number: p.policy_number,
              holder_name: p.holder_name,
              vehicle: `${p.vehicle_year} ${p.vehicle_make} ${p.vehicle_model}`,
              coverage_type: p.coverage_type,
            })),
            message: `Found ${policies.length} policies. Please confirm which one is yours.`,
          });
        }

        case "find_policy_by_name": {
          // Use ilike for case-insensitive partial matching
          const { data: policies, error } = await supabase
            .from("insurance_policies")
            .select(
              "policy_number, holder_name, holder_phone, holder_email, vehicle_year, vehicle_make, vehicle_model, coverage_type",
            )
            .ilike("holder_name", `%${args.holder_name}%`);

          if (error) {
            console.error("Error searching policies by name:", error);
            return JSON.stringify({
              found: false,
              error: "An error occurred while searching. Please try again.",
            });
          }

          if (!policies || policies.length === 0) {
            return JSON.stringify({
              found: false,
              message: "No policies found with that name. Please check the spelling or try searching by phone number.",
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
                coverage_type: policy.coverage_type,
              },
              message: `Found policy ${policy.policy_number} for ${policy.holder_name}. Vehicle: ${policy.vehicle_year} ${policy.vehicle_make} ${policy.vehicle_model}.`,
            });
          }

          // Multiple policies found
          return JSON.stringify({
            found: true,
            single_match: false,
            policies: policies.map((p) => ({
              policy_number: p.policy_number,
              holder_name: p.holder_name,
              vehicle: `${p.vehicle_year} ${p.vehicle_make} ${p.vehicle_model}`,
              coverage_type: p.coverage_type,
            })),
            message: `Found ${policies.length} policies matching that name. Please confirm which one is yours.`,
          });
        }

        case "get_policy_coverage": {
          const { data: policy } = await supabase
            .from("insurance_policies")
            .select("*")
            .eq("policy_number", args.policy_number)
            .maybeSingle();

          if (!policy) {
            return JSON.stringify({
              found: false,
              error: "Policy not found in our system. Please verify the policy number.",
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
              rental_car_coverage: policy.rental_car_coverage || false,
            },
            policy_holder: policy.holder_name,
            vehicle: {
              year: policy.vehicle_year,
              make: policy.vehicle_make,
              model: policy.vehicle_model,
            },
            message:
              "Policy coverage details retrieved. Analyze the incident to determine if the driver's needs are covered.",
          });
        }

        case "record_coverage_decision": {
          // Update the claim with the AI's coverage decision
          await supabase
            .from("claims")
            .update({
              is_covered: args.is_covered,
              coverage_details: JSON.stringify({
                services_needed: args.services_needed,
                services_covered: args.services_covered || [],
                services_not_covered: args.services_not_covered || [],
                explanation: args.coverage_explanation,
              }),
              status: "coverage_check",
            })
            .eq("id", claimId);

          return JSON.stringify({
            success: true,
            is_covered: args.is_covered,
            services_needed: args.services_needed,
            services_covered: args.services_covered || [],
            services_not_covered: args.services_not_covered || [],
            message: args.coverage_explanation,
          });
        }

        case "get_available_providers": {
          // Map from DB enum (tow_truck, repair_truck) to garage services array (tow, repair)
          const serviceToGarageMap: Record<string, string> = {
            tow_truck: "tow",
            repair_truck: "repair",
            taxi: "taxi",
            rental_car: "rental_car",
          };
          const garageServiceType = serviceToGarageMap[args.service_type] || args.service_type;

          const { data: providers, error } = await supabase
            .from("garages")
            .select("id, name, phone, address, services, average_response_time, rating")
            .contains("services", [garageServiceType])
            .order("rating", { ascending: false });

          if (error) {
            console.error("Error fetching providers:", error);
            return JSON.stringify({
              found: false,
              error: "Failed to fetch service providers.",
            });
          }

          if (!providers || providers.length === 0) {
            return JSON.stringify({
              found: false,
              service_type: args.service_type,
              message: `No providers found for ${args.service_type} service.`,
            });
          }

          return JSON.stringify({
            found: true,
            service_type: args.service_type,
            providers: providers.map((p) => ({
              id: p.id,
              name: p.name,
              phone: p.phone,
              address: p.address,
              average_response_time_minutes: p.average_response_time,
              rating: p.rating,
              services_offered: p.services,
            })),
            message: `Found ${providers.length} provider(s) for ${args.service_type} service.`,
          });
        }

        case "arrange_services": {
          const servicesToArrange = args.services_to_arrange;
          const notificationText = args.notification_message;

          const arrangedServices: any[] = [];
          const failedServices: string[] = [];

          // Process each service request
          for (const serviceRequest of servicesToArrange) {
            const serviceType = serviceRequest.service_type;

            // Map service_type (from services table) to garage services array value
            const garageServiceMap: Record<string, string> = {
              tow_truck: "tow",
              taxi: "taxi",
              repair_truck: "repair",
              rental_car: "rental_car",
            };

            let provider;

            if (serviceRequest.provider_id) {
              // Specific provider requested
              const { data } = await supabase.from("garages").select("*").eq("id", serviceRequest.provider_id).single();
              provider = data;
            } else {
              // Find best available provider (highest rating, then fastest response)
              const { data: providers } = await supabase
                .from("garages")
                .select("*")
                .contains("services", [garageServiceMap[serviceType]])
                .order("rating", { ascending: false })
                .order("average_response_time", { ascending: true })
                .limit(1);
              provider = providers?.[0];
            }

            if (!provider) {
              failedServices.push(serviceType);
              console.error(`No provider found for service type: ${serviceType}`);
              continue;
            }

            // Create service entry
            const { data: service, error: serviceError } = await supabase
              .from("services")
              .insert({
                claim_id: claimId,
                service_type: serviceType,
                provider_name: provider.name,
                provider_phone: provider.phone,
                estimated_arrival: provider.average_response_time,
                status: "dispatched",
              })
              .select()
              .single();

            if (serviceError) {
              console.error(`Error inserting ${serviceType} service:`, serviceError);
              failedServices.push(serviceType);
            } else if (service) {
              arrangedServices.push({
                ...service,
                provider_address: provider.address,
                provider_rating: provider.rating,
              });
            }
          }

          // Check if any services were arranged
          if (arrangedServices.length === 0) {
            return JSON.stringify({
              success: false,
              error: "Failed to arrange any services. No providers available.",
              failed_services: failedServices,
            });
          }

          // Update claim with arranged services - also ensure is_covered is set to true
          // since by definition, if we're arranging services, the claim must be covered
          const primaryProvider = arrangedServices.find((s) => s.service_type === "tow") || arrangedServices[0];
          await supabase
            .from("claims")
            .update({
              arranged_services: arrangedServices,
              status: "arranging_services",
              nearest_garage: primaryProvider?.provider_name,
              is_covered: true,
              coverage_details:
                claim.coverage_details ||
                JSON.stringify({
                  services_covered: servicesToArrange.map((s: any) => s.service_type),
                  explanation: "Services arranged based on policy coverage",
                }),
            })
            .eq("id", claimId);

          // Create notifications for the customer
          const notifications: any[] = [];

          // SMS notification
          if (claim.driver_phone) {
            notifications.push({
              claim_id: claimId,
              type: "sms",
              recipient: claim.driver_phone,
              message: notificationText,
              status: "pending",
            });
          }

          // Email notification
          if (claim.driver_email) {
            notifications.push({
              claim_id: claimId,
              type: "email",
              recipient: claim.driver_email,
              message: notificationText,
              status: "pending",
            });
          }

          // Insert all notifications
          if (notifications.length > 0) {
            const { error: notifError } = await supabase.from("notifications").insert(notifications);
            if (notifError) {
              console.error("Error creating notifications:", notifError);
            }
          }

          // Format response for AI
          const serviceTypeLabels: Record<string, string> = {
            tow: "Tow Truck",
            taxi: "Transportation (Taxi)",
            repair: "Mobile Repair",
            rental_car: "Rental Car",
          };

          return JSON.stringify({
            success: true,
            arranged_services: arrangedServices.map((s) => ({
              service_type: serviceTypeLabels[s.service_type] || s.service_type,
              provider_name: s.provider_name,
              provider_phone: s.provider_phone,
              provider_address: s.provider_address,
              estimated_arrival_minutes: s.estimated_arrival,
              status: s.status,
            })),
            failed_services: failedServices.length > 0 ? failedServices : undefined,
            notifications_created: notifications.length,
            message: `Successfully arranged ${arrangedServices.length} service(s). ${notifications.length} notification(s) queued for delivery.`,
          });
        }

        case "complete_claim": {
          await supabase.from("claims").update({ status: "completed" }).eq("id", claimId);
          return JSON.stringify({ success: true, message: "Claim marked as completed" });
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    }

    // Build messages for API call
    let messages = [
      { role: "system", content: SYSTEM_PROMPT + "\n" + claimContext },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    // Call OpenAI API
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    let data = await response.json();
    let choice = data.choices[0];

    // Handle tool calls in a loop
    while (choice.message.tool_calls?.length > 0) {
      console.log("Processing tool calls:", choice.message.tool_calls.length);

      // Add assistant message with tool calls
      messages.push(choice.message);

      // Execute each tool and add results
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(toolCall.function.name, args);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Get next response
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response after tool execution");
      }

      data = await response.json();
      choice = data.choices[0];
    }

    // Handle case where content might be null (happens during tool calls)
    const assistantMessage =
      choice.message.content || "I've processed your request. Is there anything else you need help with?";

    // Get updated claim status
    const { data: updatedClaim } = await supabase.from("claims").select("*").eq("id", claimId).single();

    // Save conversation history
    const updatedConversation = [
      ...conversationHistory,
      { role: "user", content: userMessage, timestamp: new Date().toISOString() },
      { role: "assistant", content: assistantMessage, timestamp: new Date().toISOString() },
    ];

    await supabase.from("claims").update({ conversation_history: updatedConversation }).eq("id", claimId);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        status: updatedClaim?.status || claim.status,
        claimData: {
          ...updatedClaim,
          conversation_history: updatedConversation,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
