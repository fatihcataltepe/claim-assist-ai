# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/b9a650e2-ae72-42fe-92a8-960c49c86e13

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b9a650e2-ae72-42fe-92a8-960c49c86e13) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Setup & Configuration

### Environment Variables

#### Frontend (.env file)

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

Get these values from your Supabase Dashboard → Settings → API.

#### Backend (Supabase Secrets)

The Edge Functions require the following secrets to be set in Supabase. **Do not add these to your `.env` file** - they should be set as Supabase secrets:

1. **OpenAI API Key** (Required for AI claim processing, text-to-speech, and audio transcription):
   ```bash
   supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
   ```

2. **Supabase Service Role Key** (Required for Edge Functions):
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Supabase URL** (Required for Edge Functions):
   ```bash
   supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
   ```

4. **Lovable API Key** (Optional - only needed for analytics-assistant function):
   ```bash
   supabase secrets set LOVABLE_API_KEY=your-lovable-api-key
   ```

**How to get your OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key and set it as a Supabase secret (it will not be shown again)

**Important Security Notes:**
- Never commit your `.env` file to version control (it's already in `.gitignore`)
- Never expose your OpenAI API key in client-side code
- Edge Function secrets are only accessible server-side
- The OpenAI API key is used by Edge Functions for:
  - AI-powered claim processing (`process-claim` function)
  - Text-to-speech conversion (`text-to-speech` function)
  - Audio transcription (`transcribe-audio` function)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b9a650e2-ae72-42fe-92a8-960c49c86e13) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Test Data - Insurance Policies

The database includes pre-seeded insurance policies for testing purposes. Use these policy numbers when submitting claims:

### Available Test Policies

| Policy Number | Holder Name | Vehicle | Coverage Type | Roadside Assistance | Towing | Rental Car | Max Towing Distance |
|--------------|-------------|---------|---------------|---------------------|--------|------------|---------------------|
| **POL-2024-001** | John Smith | 2020 Toyota Camry | Comprehensive | ✅ | ✅ | ✅ | 100 miles |
| **POL-2024-002** | Sarah Johnson | 2019 Honda Accord | Comprehensive | ✅ | ✅ | ❌ | 75 miles |
| **POL-2024-003** | Michael Brown | 2021 Ford F-150 | Collision | ✅ | ✅ | ✅ | 50 miles |
| **POL-2024-004** | Emily Davis | 2022 Tesla Model 3 | Comprehensive | ✅ | ✅ | ✅ | 100 miles |
| **POL-2024-005** | David Wilson | 2018 Chevrolet Silverado | Liability | ❌ | ❌ | ❌ | 0 miles |

### Policy Details

**POL-2024-001** (John Smith - Comprehensive Coverage)
- Full coverage with all services available
- Best for testing complete claim workflows
- Includes: Roadside assistance, towing, rental car
- Contact: +1-555-0101, john.smith@email.com

**POL-2024-002** (Sarah Johnson - Comprehensive, No Rental)
- Comprehensive coverage but no rental car option
- Good for testing claims without rental car service
- Includes: Roadside assistance, towing
- Contact: +1-555-0102, sarah.j@email.com

**POL-2024-003** (Michael Brown - Collision Coverage)
- Collision coverage with limited towing distance
- Good for testing distance-based service limitations
- Includes: Roadside assistance, towing (50 miles), rental car
- Contact: +1-555-0103, mbrown@email.com

**POL-2024-004** (Emily Davis - Comprehensive Coverage)
- Full comprehensive coverage (same as POL-2024-001)
- Electric vehicle (Tesla) for testing EV-specific scenarios
- Includes: Roadside assistance, towing, rental car
- Contact: +1-555-0104, emily.davis@email.com

**POL-2024-005** (David Wilson - Liability Only)
- Basic liability coverage with no additional services
- Good for testing claims that won't be covered
- No roadside assistance, towing, or rental car
- Contact: +1-555-0105, dwilson@email.com

### Available Service Providers (Garages)

The system includes 5 pre-configured service providers:

1. **QuickFix Auto Repair** - Downtown (Tow + Repair, 25 min response, 4.8★)
2. **Reliable Towing Service** - Midtown (Tow only, 20 min response, 4.6★)
3. **Premium Auto Care** - Uptown (Tow + Repair, 35 min response, 4.9★)
4. **24/7 Emergency Tow** - Suburbs (Tow only, 15 min response, 4.7★)
5. **Elite Collision Center** - Industrial (Tow + Repair, 30 min response, 4.5★)

### Testing Tips

- Use **POL-2024-001** or **POL-2024-004** for full-featured claim testing
- Use **POL-2024-002** to test scenarios without rental car coverage
- Use **POL-2024-005** to test denied claims or limited coverage scenarios
- All policies use realistic contact information for testing notifications
