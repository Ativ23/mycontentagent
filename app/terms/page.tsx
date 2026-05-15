import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Stacks Made Simple',
  description: 'Terms of Service for Stacks Made Simple — AI-powered short-form video creation platform.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[#8884a8] text-sm mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-[#c0bdd8] leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Acceptance of Terms</h2>
            <p>By using Stacks Made Simple (&ldquo;the App&rdquo;), you agree to these Terms of Service. If you do not agree, do not use the App.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Description of Service</h2>
            <p>Stacks Made Simple is a content creation tool that helps creators generate short-form video content for TikTok. Features include AI script generation, voiceover synthesis, video composition, and optional direct upload to TikTok via the TikTok Content Posting API.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. TikTok Integration</h2>
            <p>When you connect your TikTok account, the App requests permission to upload videos to your TikTok inbox. Videos are only sent to TikTok when you explicitly click &ldquo;Post to TikTok.&rdquo; No content is published automatically. You remain solely responsible for all content you choose to publish on TikTok.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. User Responsibilities</h2>
            <p>You are responsible for ensuring all content you generate and publish complies with TikTok&apos;s Community Guidelines, applicable laws, and third-party rights. You must not use the App to create misleading, harmful, or unlawful content.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Intellectual Property</h2>
            <p>You retain ownership of all content you create using the App. The App does not claim any rights over your generated videos, scripts, or other creative output.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Disclaimer of Warranties</h2>
            <p>The App is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee uninterrupted service or that AI-generated content will be accurate or suitable for any particular purpose.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Stacks Made Simple shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">8. Changes to Terms</h2>
            <p>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">9. Contact</h2>
            <p>Questions about these Terms? Email: <a href="mailto:stacksmadesimple@gmail.com" className="text-violet-400 hover:text-violet-300">stacksmadesimple@gmail.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
