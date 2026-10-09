// share feature — Web Share API mobile e, fallback e clipboard copy.
export const shareRequest = async ({ title, text, url }) => {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return { shared: true, method: 'native' };
    }
  } catch (error) {
    if (error?.name === 'AbortError') return { shared: false, method: 'cancelled' };
  }
  try {
    await navigator.clipboard.writeText(url);
    return { shared: true, method: 'clipboard' };
  } catch {
    return { shared: false, method: 'none' };
  }
};

// WhatsApp e direct share — emergency request er jonno fastest channel.
export const shareToWhatsApp = (text, url) => {
  const message = url ? `${text}\n${url}` : text;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
};

// masked phone number — accept holei full number dekhay, na hole middle gulo hide.
export const maskPhone = (phone, revealed = false) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (revealed) return phone;
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(2, digits.length - 7))}${digits.slice(-3)}`;
};
