import { Link } from 'wouter';

export default function PrivacyPolicy() {
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Effective date: 9 May 2025 &mdash; Last updated: 9 May 2025</p>
          </div>

          <section className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              This policy explains what personal data Teemo Ltd collects when you use SubsBuzz, why we collect it, who we share it with, and what rights you have over it. We are committed to complying with the UK General Data Protection Regulation (UK GDPR) and, where applicable, the EU General Data Protection Regulation (EU GDPR).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. Who we are</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Teemo Ltd is the data controller for personal data processed through SubsBuzz. If you have questions about how we handle your data, contact us at{' '}
              <a href="mailto:hello@teemo.ltd" className="text-primary hover:underline">hello@teemo.ltd</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. What data we collect</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We collect only what is necessary to provide the service.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Account data</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  Your Google account identifier and email address, collected when you sign in via Google OAuth. We use this to identify your account and associate your data with it.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">OAuth tokens</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  The access and refresh tokens Google issues when you grant SubsBuzz access to your Gmail account. These are stored encrypted in our database. We use them to fetch emails on your behalf. You can revoke them at any time through your{' '}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Account security settings</a>.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Monitored senders</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  The list of email sender addresses you explicitly add to SubsBuzz. We access only emails from these senders.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Digest summaries and metadata</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  For each email we process, we store the sender name, subject line, date, and the AI-generated summary. We do not store the body content of your emails. Raw email content is passed to an AI model for summarisation and discarded immediately afterwards.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Settings and preferences</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  Your in-app preferences, including inbox cleanup settings, AI provider selection, timezone, and category labels.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">What we do not collect</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  We do not use tracking pixels, advertising cookies, or third-party analytics. We do not build behavioural profiles. We do not access emails from senders you have not nominated. We do not read, index, or store full email body content.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. Why we process your data and our lawful basis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 dark:text-gray-300 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-800 dark:text-gray-200 w-1/3">Purpose</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-800 dark:text-gray-200 w-1/3">Data used</th>
                    <th className="text-left py-2 font-semibold text-gray-800 dark:text-gray-200 w-1/3">Lawful basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr>
                    <td className="py-2 pr-4 leading-relaxed">Providing the service — fetching emails, generating digests</td>
                    <td className="py-2 pr-4 leading-relaxed">Account data, OAuth tokens, monitored senders, email metadata</td>
                    <td className="py-2 leading-relaxed">Contract performance (Art. 6(1)(b) UK/EU GDPR)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 leading-relaxed">AI summarisation of email content</td>
                    <td className="py-2 pr-4 leading-relaxed">Email content (processed transiently, not stored)</td>
                    <td className="py-2 leading-relaxed">Contract performance (Art. 6(1)(b))</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 leading-relaxed">Maintaining your session after sign-in</td>
                    <td className="py-2 pr-4 leading-relaxed">Session token stored in browser localStorage</td>
                    <td className="py-2 leading-relaxed">Contract performance (Art. 6(1)(b))</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 leading-relaxed">Keeping your account secure and preventing abuse</td>
                    <td className="py-2 pr-4 leading-relaxed">Account data, token validity, revocation status</td>
                    <td className="py-2 leading-relaxed">Legitimate interests (Art. 6(1)(f))</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 leading-relaxed">Responding to data rights requests and legal obligations</td>
                    <td className="py-2 pr-4 leading-relaxed">Account data</td>
                    <td className="py-2 leading-relaxed">Legal obligation (Art. 6(1)(c))</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">4. Who we share your data with</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We do not sell your data. We share it only with the third-party processors listed below, and only to the extent necessary to provide the service.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Google LLC</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  We use the Gmail API (provided by Google) to access your inbox on your behalf. Google processes your data under its own privacy policy and the terms of its API programme. Your use of Google sign-in is also governed by Google's privacy policy.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI summarisation providers</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  Email content is sent to an AI model for summarisation. The provider depends on your account settings:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 leading-relaxed ml-2 mt-1">
                  <li>
                    <strong>DeepSeek (default)</strong> — operated by Hangzhou DeepSeek Artificial Intelligence Co., Ltd., based in China. Data transferred under standard contractual clauses (SCCs) or equivalent safeguards where applicable. See{' '}
                    <a href="https://www.deepseek.com/privacy_policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">DeepSeek's privacy policy</a>.
                  </li>
                  <li>
                    <strong>OpenAI</strong> — operated by OpenAI, LLC, based in the United States. Transfers to the US are covered by the EU-US Data Privacy Framework and OpenAI's data processing addendum. See{' '}
                    <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI's privacy policy</a>.
                  </li>
                </ul>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                  In both cases, only the content of emails from your nominated senders is sent for summarisation. Content is processed transiently and not retained by these providers for training purposes under their API terms.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">DigitalOcean, LLC</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                  Our servers and database are hosted on DigitalOcean infrastructure. All stored data resides on servers in the European Union or United Kingdom. DigitalOcean acts as a data processor under our instructions.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">5. International data transfers</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Your account data and digest summaries are stored within the EU/UK. When email content is sent to an AI provider for summarisation, it may be transferred outside the EU/UK:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 leading-relaxed ml-2">
              <li>Transfers to OpenAI (US) are made under the EU-US Data Privacy Framework and standard contractual clauses.</li>
              <li>Transfers to DeepSeek (China) are made under standard contractual clauses. China does not have an adequacy decision from the UK or EU. If you have concerns about this transfer, you can switch to OpenAI in your account settings, or contact us to discuss alternatives.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">6. How long we keep your data</h2>
            <div className="space-y-2">
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium w-48 shrink-0">Account and settings</span>
                <span>Until you delete your account, then purged within 30 days.</span>
              </div>
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium w-48 shrink-0">OAuth tokens</span>
                <span>Until revoked by you (via Google or within the app) or until your account is deleted.</span>
              </div>
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium w-48 shrink-0">Digest summaries</span>
                <span>Retained while your account is active. Deleted when your account is deleted.</span>
              </div>
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium w-48 shrink-0">Raw email content</span>
                <span>Never stored. Processed in memory only and discarded immediately after summarisation.</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">7. Cookies and local storage</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              SubsBuzz does not use tracking cookies or advertising cookies. We do not use third-party analytics services. We store the following data in your browser:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 leading-relaxed ml-2">
              <li><strong>localStorage</strong> — your session token and JWT access token, used to keep you signed in between visits. These are strictly necessary for the service to function. No consent is required under PECR.</li>
              <li><strong>sessionStorage</strong> — temporary state (such as a pending action) held only for the duration of your browser tab session. Cleared when you close the tab.</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              No browser cookies are set by SubsBuzz. No data stored in your browser is shared with third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">8. Your rights</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Under UK GDPR (and EU GDPR where applicable), you have the following rights:
            </p>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to access</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can request a copy of the personal data we hold about you.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to rectification</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can ask us to correct inaccurate data we hold about you.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to erasure</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can ask us to delete your account and all associated personal data. We will do so within 30 days.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to restriction</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can ask us to restrict processing of your data in certain circumstances — for example, while a complaint is being resolved.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to data portability</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can request a copy of your data in a structured, machine-readable format where the processing is based on contract or consent.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Right to object</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">You can object to processing based on legitimate interests. We will stop unless we have compelling legitimate grounds that override your interests.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Withdrawing consent / revoking Gmail access</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">
                  You can revoke Gmail access at any time via your{' '}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Account permissions page</a>. This does not delete your SubsBuzz account or digest history — contact us if you also want those removed.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:hello@teemo.ltd" className="text-primary hover:underline">hello@teemo.ltd</a>. We will respond within one month. We may ask you to verify your identity before acting on a request.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">9. Automated processing</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              SubsBuzz uses AI models to generate summaries of your emails. This is automated processing, but it does not produce any decision that significantly affects you. The AI output is a summary for your own reading — it has no legal or similarly significant effect. No profiling for advertising or behavioural targeting takes place.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">10. Security</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We take reasonable technical and organisational measures to protect your personal data against unauthorised access, loss, or disclosure. OAuth tokens are stored encrypted at rest. All data in transit is encrypted via TLS. Access to our production systems is restricted to authorised personnel. We will notify you and the relevant supervisory authority of a data breach where required by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">11. How to complain</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              If you have a concern about how we handle your data, please contact us first at{' '}
              <a href="mailto:hello@teemo.ltd" className="text-primary hover:underline">hello@teemo.ltd</a> and we will try to resolve it.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              If you are not satisfied with our response, you have the right to lodge a complaint with a supervisory authority. For UK residents, this is the Information Commissioner's Office (ICO):{' '}
              <a href="https://ico.org.uk/make-a-complaint" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ico.org.uk/make-a-complaint</a>. For EU residents, contact your national data protection authority.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">12. Changes to this policy</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We may update this policy from time to time. Where changes are material, we will notify you by email or by displaying a notice in the application before the changes take effect. The effective date at the top of this page shows when the current version was published.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">13. Contact</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Teemo Ltd<br />
              <a href="mailto:hello@teemo.ltd" className="text-primary hover:underline">hello@teemo.ltd</a>
            </p>
          </section>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex gap-6">
            <Link href="/login" className="text-sm text-primary hover:underline">
              &larr; Back to sign in
            </Link>
            <Link href="/tos" className="text-sm text-primary hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
