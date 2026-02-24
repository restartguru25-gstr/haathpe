import { Link } from "react-router-dom";
import PolicyPageLayout from "@/components/PolicyPageLayout";

export default function RefundPolicy() {
  return (
      <PolicyPageLayout title="Refund & Cancellation Policy">
        <section className="space-y-4">
          <p>
            <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong> operates www.haathpe.com. This policy outlines our
            refund and cancellation terms for transactions on the platform.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">1. Cancellation by Customer</h2>
          <p>
            You may request cancellation of an order before it has been shipped or fulfilled. Once the order is
            processed or dispatched, cancellation may not be possible; in such cases refund eligibility will be as per
            the provisions below.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">2. Refund Eligibility</h2>
          <p>
            Refunds are considered in cases of: (a) cancelled orders before dispatch, (b) defective or incorrect
            products, (c) non-delivery within the stated timeframe, or (d) duplicate or erroneous charges. Refunds are
            subject to verification and our internal policy.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">3. Refund Timeline</h2>
          <p>
            Eligible refunds will be processed within <strong>7–10 business days</strong> from the date of approval.
            The amount will be credited to the original payment method (card/UPI/wallet/bank) as per the payment
            gateway’s and bank’s processing time.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">4. Partial Refunds</h2>
          <p>
            In case of partial fulfilment or partial damage, we may issue a partial refund proportionate to the
            affected part of the order.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">5. Non-Refundable Cases</h2>
          <p>
            Services or products that have been fully consumed, or orders that do not meet our refund criteria, may not
            qualify for a refund. Any exceptions are at the sole discretion of DOCILE ONLINE MART PRIVATE LIMITED.
          </p>
          <h2 className="text-sm font-semibold text-foreground mt-6">6. How to Request</h2>
          <p>
            To request a refund or cancellation, please contact us with your order details using the phone number,
            email, or address given on our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
          <p className="mt-6 text-sm">
            For registered address and contact details of <strong>DOCILE ONLINE MART PRIVATE LIMITED</strong>, please
            see our <Link to="/contact" className="text-primary underline">Contact Us</Link> page.
          </p>
        </section>
      </PolicyPageLayout>
  );
}
