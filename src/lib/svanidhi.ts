/**
 * PM SVANidhi Boost – stub for linking to govt scheme with transaction history as proof.
 * In production: replace with ONDC/SVANidhi API pre-filled application.
 * @see https://pmsvanidhi.mohua.gov.in/
 */
const SVANIDHI_BASE = "https://pmsvanidhi.mohua.gov.in/";

export function getSvanidhiBoostUrl(vendorId: string): string {
  const params = new URLSearchParams({
    source: "vendorhub",
    vendor_id: vendorId,
    proof: "transaction_history",
  });
  return `${SVANIDHI_BASE}?${params.toString()}`;
}
