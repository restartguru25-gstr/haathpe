import { Link } from "react-router-dom";
import PolicyPageLayout from "@/components/PolicyPageLayout";

export default function TermsAndConditions() {
  return (
      <PolicyPageLayout title="Terms & Conditions">
        <section className="space-y-4">
          <p>
            These Terms and Conditions govern your use of the website www.haathpe.com and related services operated by{" "}
            <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong> (“Company”, “we”, “us”).
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">1. Acceptance</h2>
          <p>
            By accessing or using our website and services, you agree to be bound by these Terms. If you do not agree,
            please do not use the platform.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">2. Services & Pricing</h2>
          <p>
            We provide an e-commerce and ordering platform. All prices are displayed in Indian Rupees (₹ INR). We
            reserve the right to modify services and pricing subject to applicable law.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">3. User Conduct</h2>
          <p>
            You must use the platform lawfully and not for any fraudulent or unauthorised purpose. You are responsible
            for maintaining the confidentiality of your account.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">4. Payments</h2>
          <p>
            Payments are processed through RBI-compliant payment gateways. By making a payment, you also agree to the
            respective gateway’s terms. Refunds are governed by our Refund & Cancellation Policy.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">5. Limitation of Liability</h2>
          <p>
            To the extent permitted by law, DOCILE ONLINE MART PRIVATE LIMITED shall not be liable for indirect,
            incidental, or consequential damages arising from use of the platform.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">6. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction
            of the courts at the place of our registered office.
          </p>
          <p className="mt-6 text-sm">
            For contact details and registered address of <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong>, please
            see our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
        </section>
      </PolicyPageLayout>
  );
}
