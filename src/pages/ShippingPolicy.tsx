import { Link } from "react-router-dom";
import PolicyPageLayout from "@/components/PolicyPageLayout";

export default function ShippingPolicy() {
  return (
      <PolicyPageLayout title="Shipping & Delivery Policy">
        <section className="space-y-4">
          <p>
            <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong> operates www.haathpe.com. This policy describes how we
            handle shipping and delivery for product-based orders on our platform.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">1. Delivery Areas</h2>
          <p>
            We currently offer delivery within our service areas (including Hyderabad and other cities as updated on
            the platform). Delivery availability may vary by product and seller. You can check delivery options at
            checkout.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">2. Delivery Timelines</h2>
          <p>
            Estimated delivery times are shown at the time of order. For local/same-day delivery areas, orders placed
            within cut-off time may be delivered the same day; otherwise delivery is typically within 1–3 business
            days subject to location and product type. These are indicative and not guaranteed.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">3. Shipping Charges</h2>
          <p>
            Shipping charges, if any, are displayed before payment. All amounts are in Indian Rupees (₹ INR). Free
            delivery may apply for certain orders or regions as per our then-current policy.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">4. Order Tracking</h2>
          <p>
            Where available, you can track your order through the app or website using the order ID or link provided
            after placement.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">5. Failed Delivery & Redelivery</h2>
          <p>
            If delivery cannot be completed (e.g. wrong address, recipient unavailable), we or our logistics partner
            may attempt redelivery or contact you. Unclaimed orders may be returned and refund processed as per our
            Refund & Cancellation Policy.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">6. Damage or Loss</h2>
          <p>
            Please verify the package at delivery. For damage or loss in transit, report to us within 24–48 hours with
            supporting details. We will assist in resolution as per our policy and applicable law.
          </p>
          <p className="mt-6 text-sm">
            For queries regarding shipping or the registered address of <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong>,
            please see our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
        </section>
      </PolicyPageLayout>
  );
}
