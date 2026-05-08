import { Link } from 'wouter';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/login">
            <img src="/logo-banner-bk.png" alt="SubsBuzz" className="h-8 w-auto object-contain dark:hidden" />
            <img src="/logo-banner-wt.png" alt="SubsBuzz" className="h-8 w-auto object-contain hidden dark:block" />
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Terms of Service</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Effective date: 8 May 2025</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. About SubsBuzz</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              SubsBuzz is an email digest service operated by Teemo Ltd ("we", "us", "our"). It connects to your Gmail account, reads emails from senders you explicitly nominate, and uses an AI model to produce a summarised daily digest. These Terms govern your use of the service at subsbuzz.com and any associated applications.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. Your voluntary consent</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              By connecting your Google account and using SubsBuzz, you are voluntarily authorising us to access your Gmail inbox on your behalf. You initiate this access, you choose which senders to monitor, and you can revoke access at any time through your Google Account security settings or by deleting your SubsBuzz account. We do not request or use any access you have not explicitly granted.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. How we access your email</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We request Gmail modify access (<code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">gmail.modify</code>) via the Gmail API. This scope allows us to read emails from senders you have nominated, apply labels you configure, mark emails as read, and archive emails — actions we perform only when you have explicitly enabled inbox cleanup features. We do not access, index, or process any other emails in your inbox. We do not store the body content of your emails. We store only the metadata and AI-generated summaries necessary to produce your digest (sender name, subject, date, and the summary text). Raw email bodies are processed in memory and discarded immediately after summarisation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">4. What we store</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We store the following data associated with your account:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 leading-relaxed ml-2">
              <li>Your Google account identifier and email address</li>
              <li>OAuth tokens required to maintain your Gmail connection</li>
              <li>The list of senders you have chosen to monitor</li>
              <li>AI-generated digest summaries and metadata (sender, subject, date)</li>
              <li>Your account preferences and settings</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We do not sell, rent, or share your data with any third party except where necessary to provide the service (for example, passing email content to an AI model for summarisation). Any AI model we use receives only the minimum content required to produce a summary and does not retain that content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">5. Acceptable use</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You may only use SubsBuzz for your own personal email account. You may not use the service to access another person's email without their explicit consent, to scrape or aggregate content at scale for commercial resale, or in any way that violates Google's Terms of Service or applicable law. We reserve the right to suspend or terminate accounts that misuse the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">6. No availability guarantee</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              SubsBuzz is provided on a best-efforts basis. We make no representations or warranties regarding uptime, availability, or continuity of service. The service may be interrupted, suspended, or discontinued at any time without notice. Digest generation may fail or be delayed due to Gmail API quotas, third-party AI service availability, or maintenance. We are not liable for any loss resulting from an interruption or failure of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">7. Disclaimer of warranties</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              The service is provided "as is" and "as available" without warranty of any kind, express or implied. We disclaim all warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, and non-infringement. AI-generated summaries are produced automatically and may be inaccurate, incomplete, or misleading. You should not rely on digest content as the sole source of information about any matter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">8. Limitation of liability</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              To the fullest extent permitted by applicable law, Teemo Ltd and its directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of SubsBuzz, including but not limited to loss of data, loss of revenue, missed emails, inaccurate summaries, or any other loss, even if we have been advised of the possibility of such damages.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Our total aggregate liability to you for any claim arising out of or in connection with these Terms or the service shall not exceed the greater of (a) the amount you paid us in the twelve months preceding the claim or (b) £50.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">9. Indemnification</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You agree to indemnify and hold harmless Teemo Ltd and its officers, directors, employees, and agents from any claim, demand, loss, or damage (including reasonable legal fees) made by a third party arising out of your use of the service, your violation of these Terms, or your violation of any rights of another person.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">10. Intellectual property</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              The SubsBuzz software, design, and branding are the property of Teemo Ltd. Your email content and any original material in your digests remain yours. You grant us a limited licence to process your email content solely to provide the service. This licence ends when you revoke Gmail access or delete your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">11. Account termination</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You may stop using SubsBuzz at any time. To remove your data, contact us at the address below and we will delete your account and all associated data within 30 days. We may also terminate your account if you breach these Terms, with or without notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">12. Changes to these Terms</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We may update these Terms from time to time. Where changes are material, we will notify you by email or by displaying a notice in the application before the changes take effect. Continued use of the service after the effective date of updated Terms constitutes your acceptance of the changes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">13. Governing law</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              These Terms are governed by the laws of England and Wales. Any dispute arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">14. Contact</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Teemo Ltd<br />
              Questions or requests regarding these Terms or your data should be sent to:{' '}
              <a href="mailto:hello@teemo.ltd" className="text-primary hover:underline">hello@teemo.ltd</a>
            </p>
          </section>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <Link href="/login" className="text-sm text-primary hover:underline">
              &larr; Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
