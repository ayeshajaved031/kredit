// ==============================================================
// Murabaha Contract Terms Template
// --------------------------------------------------------------
// Generates the legal terms text for a Murabaha contract. The
// generated string is stored on the contract at creation time
// (MurabahaContract.termsAndConditions) so future template
// changes never affect already-issued contracts.
//
// Disclaimer: this template is for the educational MVP. In a
// real product, the wording would be reviewed by a Shariah
// advisor (e.g., from the State Bank's Shariah Advisory
// Committee or a Meezan Bank-affiliated scholar) and a lawyer.
// ==============================================================

/**
 * Build the contract T&C string.
 * @param {Object} ctx
 * @param {string} ctx.contractId
 * @param {string} ctx.startupName
 * @param {string} ctx.vendorName
 * @param {string} ctx.subscriptionPlan
 * @param {number} ctx.principal
 * @param {number} ctx.markupPercent
 * @param {number} ctx.markupAmount
 * @param {number} ctx.totalPayable
 * @param {number} ctx.monthlyInstallment
 * @param {number} ctx.installmentCount
 * @param {number} ctx.latePaymentFeePercent
 * @returns {string}
 */
const buildTerms = (ctx) => {
  const fmt = (n) => `PKR ${Number(n).toLocaleString("en-PK")}`;

  return `
KREDIT MURABAHA FINANCING AGREEMENT

Contract ID: ${ctx.contractId}
Effective upon signing by the Client.

PARTIES
- "Kredit" (the Financier) — Kredit (Pvt.) Ltd., Pakistan.
- "Client" — ${ctx.startupName}.

ASSET
The asset under this Murabaha is the annual subscription to:
  Vendor: ${ctx.vendorName}
  Plan:   ${ctx.subscriptionPlan}

1. NATURE OF THE TRANSACTION
This is a Shariah-compliant Murabaha sale. Kredit purchases the asset
described above directly from the vendor and immediately sells the
same asset to the Client at the Total Sale Price stated in clause 2.
The Client takes constructive possession of the asset upon execution
of this Agreement. No interest (riba) is charged at any stage.

2. PRICING (FIXED, DISCLOSED, NON-VARIABLE)
- Cost Price (Kredit's purchase from vendor):  ${fmt(ctx.principal)}
- Disclosed Profit Margin (markup):            ${ctx.markupPercent.toFixed(2)}%
- Profit Amount:                               ${fmt(ctx.markupAmount)}
- Total Sale Price payable by Client:          ${fmt(ctx.totalPayable)}

The Profit Amount is fixed at the time of contract execution and
will not change for any reason — including delayed payment.

3. PAYMENT SCHEDULE
The Total Sale Price is payable in ${ctx.installmentCount} equal monthly
installments of approximately ${fmt(ctx.monthlyInstallment)} each.
A detailed schedule with due dates is attached as the Repayment
Schedule and forms an integral part of this Agreement.

The first installment is due thirty (30) days from the activation
date. Subsequent installments are due monthly thereafter.

4. PAYMENT METHODS
The Client authorizes Kredit to deduct each due installment from
the Client's nominated account using the registered payment
method (JazzCash, EasyPaisa, PayFast, or bank transfer).

5. LATE PAYMENT
If an installment is not paid on its due date, an administrative
charge of ${ctx.latePaymentFeePercent.toFixed(2)}% of the installment amount may apply. To
preserve Shariah compliance, all amounts collected as late charges
are donated to charity and do not form part of Kredit's revenue.

6. DEFAULT
The Client is considered in default if three (3) consecutive
installments remain unpaid for more than thirty (30) days each.
Upon default, Kredit reserves the right to:
  (a) suspend the Client's access to further financing,
  (b) report the default to internal credit records, and
  (c) pursue lawful recovery of the unpaid balance.

7. EARLY SETTLEMENT
The Client may settle the outstanding balance at any time. Because
the profit is fixed in advance and not interest-based, early
settlement does not reduce the disclosed Profit Amount. Kredit
may, at its sole discretion, offer a partial discount as an act
of goodwill (ibra').

8. ASSIGNMENT
Neither party may assign this Agreement without the written consent
of the other.

9. GOVERNING LAW
This Agreement is governed by the laws of the Islamic Republic of
Pakistan and is intended to comply with the principles of Shariah
as commonly accepted in Pakistani Islamic finance practice.

10. ELECTRONIC EXECUTION
The Client's electronic signature, together with re-entry of the
account password at the time of signing, constitutes a binding
acceptance of this Agreement under the Electronic Transactions
Ordinance, 2002 (Pakistan).

By signing below, the Client confirms that they have read,
understood, and accepted all terms above.
`.trim();
};

module.exports = { buildTerms };
