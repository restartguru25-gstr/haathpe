import { Link } from "react-router-dom";
import PolicyPageLayout from "@/components/PolicyPageLayout";

export default function AboutUs() {
  return (
    <PolicyPageLayout title="About Us">
      <section className="space-y-4">
        <p>
          <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong> operates haathpe (www.haathpe.com), an e-commerce and
          services platform for local shops, dukaanwaale, and customers in India.
        </p>
        <p>
          We connect small retailers with supplies, digital sales tools, and customers. Our services include product
          catalog, online ordering, payment processing (including through CCAvenue and other RBI-compliant gateways),
          and delivery support. All pricing on the platform is in Indian Rupees (₹ INR).
        </p>
        <p>
          For queries or support, please visit our <Link to="/contact" className="text-primary underline">Contact Us</Link> page
          for registered address, phone number, and email.
        </p>
      </section>
    </PolicyPageLayout>
  );
}
