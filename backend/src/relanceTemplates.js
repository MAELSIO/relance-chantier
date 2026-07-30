function fmtDateFR(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtAmount(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function daysLate(dueDate) {
  const d0 = new Date(dueDate); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(); d1.setHours(0, 0, 0, 0);
  return Math.round((d1 - d0) / 86400000);
}

function buildSubject(level, invoiceNumber) {
  const ref = invoiceNumber ? (' n° ' + invoiceNumber) : '';
  if (level === 1) return 'Rappel — Facture' + ref + ' en attente de règlement';
  if (level === 2) return 'Relance — Facture' + ref + ' toujours impayée';
  return 'Mise en demeure — Facture' + ref + ' impayée';
}

function buildEmailBody({ level, artisanName, clientName, clientType, invoiceNumber, amount, dueDate }) {
  const greeting = clientType === 'particulier' ? ('Bonjour ' + clientName + ',') : 'Bonjour,';
  const ref = invoiceNumber ? (' n° ' + invoiceNumber) : '';
  const late = daysLate(dueDate);
  const lateText = late > 0
    ? ('échue depuis ' + late + ' jour' + (late > 1 ? 's' : '') + ' (échéance du ' + fmtDateFR(dueDate) + ')')
    : ('à échéance du ' + fmtDateFR(dueDate));
  const signature = '\n\nCordialement,\n' + artisanName;

  if (level === 1) {
    return greeting + '\n\n' +
      "Je me permets de revenir vers vous concernant la facture" + ref + " d'un montant de " + fmtAmount(amount) + ', ' + lateText + ".\n\n" +
      "C'est probablement un oubli de votre part — pourriez-vous procéder au règlement dans les meilleurs délais ? Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message." +
      signature;
  }
  if (level === 2) {
    const penalite = clientType === 'professionnel'
      ? "\n\nJe vous rappelle qu'au-delà de ce délai, des pénalités de retard ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement pourront s'appliquer, conformément à l'article L441-10 du Code de commerce."
      : '\n\nÀ défaut de règlement, des frais de recouvrement pourront s\'appliquer conformément à nos conditions générales de vente.';
    return greeting + '\n\n' +
      "Malgré un premier rappel, la facture" + ref + " d'un montant de " + fmtAmount(amount) + ' reste impayée, ' + lateText + ".\n\n" +
      "Je vous demande de bien vouloir régulariser cette situation sous 8 jours à compter de ce message." +
      penalite + signature;
  }
  const legalRef = clientType === 'professionnel'
    ? "Conformément à l'article L441-10 du Code de commerce, des pénalités de retard ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement sont d'ores et déjà dues de plein droit."
    : "À défaut de règlement dans ce délai, des frais de recouvrement pourront être appliqués conformément à nos conditions générales de vente.";
  return clientName + ',\n\n' +
    "Malgré (nos) relance(s) précédente(s), la facture" + ref + " d'un montant de " + fmtAmount(amount) + ', ' + lateText + ', demeure impayée à ce jour.\n\n' +
    "Par la présente, je vous mets en demeure de procéder au règlement intégral de cette somme sous un délai de 8 jours à compter de la réception de ce courrier.\n\n" +
    legalRef + '\n\n' +
    "À défaut de règlement dans ce délai, je me verrai contraint(e) d'engager toute procédure utile au recouvrement de cette créance, y compris une procédure judiciaire, sans autre préavis." +
    "\n\nDans l'attente d'une régularisation rapide de votre part," + signature;
}

/**
 * Reminder cadence relative to due date, in days late.
 * Level 1 at J+7, level 2 at J+15, level 3 (mise en demeure) at J+30.
 */
const REMINDER_SCHEDULE = [
  { level: 1, atDaysLate: 7 },
  { level: 2, atDaysLate: 15 },
  { level: 3, atDaysLate: 30 }
];

module.exports = { fmtDateFR, fmtAmount, daysLate, buildSubject, buildEmailBody, REMINDER_SCHEDULE };
