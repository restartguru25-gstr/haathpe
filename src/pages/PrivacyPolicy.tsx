import { Link } from "react-router-dom";
import PolicyPageLayout from "@/components/PolicyPageLayout";

export default function PrivacyPolicy() {
  return (
      <PolicyPageLayout title="Privacy Policy">
        <section className="space-y-4">
          <p>
            <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong> (“we”, “Company”) operates www.haathpe.com. This Privacy
            Policy explains how we collect, use, and protect your information in compliance with applicable Indian law.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">1. Information We Collect</h2>
          <p>
            We may collect name, contact details (phone, email), address, payment-related information (processed via
            RBI-compliant gateways), device information, and usage data when you use our website or services.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">2. How We Use Your Data</h2>
          <p>
            We use your data to provide and improve our services, process orders and payments, communicate with you,
            comply with legal obligations, and for security and fraud prevention.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">3. Sharing & Disclosure</h2>
          <p>
            We may share data with payment gateways, delivery partners, and as required by law. We do not sell your
            personal information to third parties for marketing.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">4. Data Security</h2>
          <p>
            We implement reasonable technical and organisational measures to protect your data. Payment data is
            handled by certified payment processors.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">5. Your Rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data by contacting us at the details
            provided on our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">6. Updates</h2>
          <p>
            We may update this policy from time to time. The revised policy will be posted on this page with an updated
            date.
          </p>
          <p className="mt-6 text-sm">
            For the registered address and contact details of <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong>,
            please see our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
        </section>
      </PolicyPageLayout>
  );
}
