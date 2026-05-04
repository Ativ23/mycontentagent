export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#8884a8] text-sm mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-[#c0bdd8] leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Overview</h2>
            <p>Stacks Made Simple (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the App&rdquo;) is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">TikTok OAuth tokens</strong> — access and refresh tokens obtained when you connect your TikTok account. Stored securely in our database and used solely to upload videos on your behalf.</li>
              <li><strong className="text-white">Content packages</strong> — scripts, captions, and video files you generate using the App. Stored in our database and Supabase storage.</li>
              <li><strong className="text-white">Usage data</strong> — basic API request logs for debugging purposes. Not shared with third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the App&apos;s features</li>
              <li>To upload videos to TikTok on your explicit instruction</li>
              <li>To store your generated content for your own use</li>
            </ul>
            <p className="mt-2">We do not sell, share, or monetize your data. We do not use your content for AI training.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. TikTok Data</h2>
            <p>When you connect TikTok, we receive and store OAuth access and refresh tokens. We use these tokens only to upload videos you explicitly choose to send. We do not access your TikTok profile, followers, messages, or any data beyond what is needed for video upload.</p>
            <p className="mt-2">You can revoke TikTok access at any time by disconnecting in Settings, or by revoking app permissions directly in your TikTok account settings.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Third-Party Services</h2>
            <p>The App integrates with the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>TikTok (video publishing)</li>
              <li>Anthropic (AI script generation)</li>
              <li>ElevenLabs (AI voice synthesis)</li>
              <li>Runway ML (AI video generation)</li>
              <li>Supabase (database and file storage)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Data Retention</h2>
            <p>Your content and TikTok tokens are retained until you delete them or disconnect your account. You can request deletion of all your data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Security</h2>
            <p>We use industry-standard security practices to protect your data. OAuth tokens are stored in a secured database with row-level access controls.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">8. Your Rights</h2>
            <p>You have the right to access, correct, or delete your data at any time. Contact us at <a href="mailto:stacksmadesimple@gmail.com" className="text-violet-400 hover:text-violet-300">stacksmadesimple@gmail.com</a> to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">9. Contact</h2>
            <p>Privacy questions: <a href="mailto:stacksmadesimple@gmail.com" className="text-violet-400 hover:text-violet-300">stacksmadesimple@gmail.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
