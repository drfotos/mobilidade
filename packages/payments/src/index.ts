export type PaymentProviderName = 'mercadopago' | 'stripe' | 'asaas' | 'cash' | 'machine';

export interface CreateChargeOpts {
  amount: number; description: string; passengerEmail: string; passengerPhone?: string;
  rideId: string; companyId: string; commissionRate: number; driverPayout: number; metadata?: Record<string, unknown>;
}
export interface ChargeResult {
  providerPaymentId: string; status: 'pending' | 'approved' | 'rejected';
  pixCode?: string; pixQrCode?: string; checkoutUrl?: string;
}
export interface WebhookEvent {
  providerPaymentId: string; status: 'pending' | 'paid' | 'failed' | 'refunded' | 'chargedback'; amount: number; raw: unknown;
}

export async function openMercadoPagoCheckout(preferenceId: string): Promise<void> {
  if (typeof window === 'undefined') throw new Error('openMercadoPagoCheckout só pode ser chamado no browser');
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar SDK Mercado Pago'));
    document.body.appendChild(s);
  });
  // @ts-ignore
  const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '');
  mp.checkout({ preference: { id: preferenceId }, autoOpen: true });
}

export function calculateSplit(totalAmount: number, commissionRate: number): { commission: number; driverPayout: number } {
  const commission = +(totalAmount * commissionRate).toFixed(2);
  return { commission, driverPayout: +(totalAmount - commission).toFixed(2) };
}

export function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    mercadopago: 'Mercado Pago', stripe: 'Cartão (Stripe)', asaas: 'Asaas',
    cash: 'Dinheiro', machine: 'Maquininha', pix: 'PIX',
    credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito',
  };
  return labels[method] || method;
}
