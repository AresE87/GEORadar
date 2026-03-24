import { Resend } from 'resend';

function getClient(): Resend {
  return new Resend(import.meta.env.RESEND_API_KEY);
}

function getFromEmail(): string {
  return import.meta.env.RESEND_FROM_EMAIL || 'alerts@georadar.io';
}

export async function sendScoreAlertEmail(
  to: string,
  brandName: string,
  oldScore: number,
  newScore: number,
  changeDirection: 'up' | 'down'
): Promise<void> {
  const resend = getClient();
  const change = Math.abs(newScore - oldScore);
  const arrow = changeDirection === 'up' ? '↑' : '↓';
  const color = changeDirection === 'up' ? '#22C55E' : '#EF4444';

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `Tu GEO Score de ${brandName} cambió ${arrow}${change} puntos`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E293B;">Cambio en tu GEO Score</h2>
        <p>Tu marca <strong>${brandName}</strong> tuvo un cambio significativo:</p>
        <div style="display: flex; align-items: center; gap: 16px; margin: 24px 0;">
          <span style="font-size: 32px; color: #94A3B8;">${Math.round(oldScore)}</span>
          <span style="font-size: 24px; color: ${color};">${arrow}</span>
          <span style="font-size: 32px; font-weight: bold; color: ${color};">${Math.round(newScore)}</span>
        </div>
        <a href="${import.meta.env.PUBLIC_APP_URL}/dashboard"
           style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Ver detalles en tu dashboard
        </a>
        <p style="color: #94A3B8; font-size: 12px; margin-top: 32px;">
          Recibes este email porque tienes alertas activadas en GEORadar.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const resend = getClient();
  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: 'Bienvenido a GEORadar',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E293B;">Bienvenido a GEORadar, ${name || 'usuario'}!</h2>
        <p>Tu cuenta está lista. Empieza configurando tu primera marca para monitorear su visibilidad en IA.</p>
        <a href="${import.meta.env.PUBLIC_APP_URL}/dashboard"
           style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Ir al Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendAuditReportEmail(
  to: string,
  brandName: string,
  score: number,
  quickWins: Array<{ title: string; description: string }>
): Promise<void> {
  const resend = getClient();
  const winsHtml = quickWins
    .map((w) => `<li><strong>${w.title}:</strong> ${w.description}</li>`)
    .join('');

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `Tu reporte de visibilidad IA: ${brandName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E293B;">Reporte de Visibilidad IA</h2>
        <p>Tu marca <strong>${brandName}</strong> obtuvo un GEO Score de <strong>${score}/100</strong>.</p>
        <h3>Quick Wins:</h3>
        <ul>${winsHtml}</ul>
        <a href="${import.meta.env.PUBLIC_APP_URL}/login"
           style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Monitorea tu visibilidad gratis
        </a>
      </div>
    `,
  });
}

export async function sendPaymentFailedEmail(to: string, name: string): Promise<void> {
  const resend = getClient();
  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: 'Problema con tu pago en GEORadar',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E293B;">Problema con tu pago</h2>
        <p>Hola ${name || 'usuario'}, no pudimos procesar tu último pago.</p>
        <p>Actualiza tu método de pago para mantener tu suscripción activa.</p>
        <a href="${import.meta.env.PUBLIC_APP_URL}/dashboard/settings"
           style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Actualizar método de pago
        </a>
      </div>
    `,
  });
}
