import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact | Stacks Made Simple',
  description: 'Get in touch with the Stacks Made Simple support team.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-[#8884a8] text-sm mb-10">We&apos;re here to help.</p>

        <div className="space-y-8 text-[#c0bdd8] leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">Support</h2>
            <p>
              For questions, bug reports, or account issues, email us at{' '}
              <a href="mailto:support@stacksmadesimple.xyz" className="text-violet-400 hover:text-violet-300">
                support@stacksmadesimple.xyz
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">General Enquiries</h2>
            <p>
              For partnership or business enquiries, reach us at{' '}
              <a href="mailto:hello@stacksmadesimple.xyz" className="text-violet-400 hover:text-violet-300">
                hello@stacksmadesimple.xyz
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">About</h2>
            <p>
              Stacks Made Simple is an AI-powered short-form video creation platform. We help creators
              generate scripts, voiceovers, and videos for TikTok and other platforms — across any niche.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">Response Time</h2>
            <p>We aim to respond to all enquiries within 2 business days.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
