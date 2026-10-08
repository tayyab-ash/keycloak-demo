import { randomUUID } from 'node:crypto';

export interface MimeMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Builds an RFC 2822 multipart/alternative message (text + HTML) and returns it
 * base64url-encoded, as required by the Gmail API `raw` field.
 */
export function buildRawMimeMessage(message: MimeMessage): string {
  const boundary = `alt_${randomUUID()}`;

  const lines = [
    `From: ${formatAddress(message.from)}`,
    `To: ${formatAddress(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(message.html),
    `--${boundary}--`,
    '',
  ];

  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function isPrintableAscii(value: string): boolean {
  return /^[\x20-\x7e]*$/.test(value);
}

/** RFC 2047 encoded-word for non-ASCII header values. */
function encodeHeader(value: string): string {
  const clean = stripLineBreaks(value);
  return isPrintableAscii(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

/** Accepts `user@example.com` or `Display Name <user@example.com>`. */
function formatAddress(value: string): string {
  const clean = stripLineBreaks(value);
  const match = /^(.*?)\s*<([^<>\s]+)>$/.exec(clean);
  if (!match) {
    return clean;
  }

  const name = match[1].replace(/^"(.*)"$/, '$1').trim();
  const address = match[2];
  if (!name) {
    return address;
  }

  const encodedName = isPrintableAscii(name)
    ? `"${name.replace(/["\\]/g, '\\$&')}"`
    : encodeHeader(name);
  return `${encodedName} <${address}>`;
}

/** Base64 body wrapped at 76 characters per RFC 2045. */
function encodeBody(value: string): string {
  const base64 = Buffer.from(value.replace(/\r?\n/g, '\r\n'), 'utf8').toString(
    'base64',
  );
  return base64.match(/.{1,76}/g)?.join('\r\n') ?? '';
}
