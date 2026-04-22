const { Resend } = require('resend');

function getTrimmedValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const articleTitle = getTrimmedValue(req.body?.articleTitle);
    const authorName = getTrimmedValue(req.body?.authorName);
    const authorEmail = getTrimmedValue(req.body?.authorEmail);

    if (!articleTitle || !authorName || !authorEmail) {
      return res.status(400).json({
        success: false,
        error: 'articleTitle, authorName, and authorEmail are required.',
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('Notify API error: RESEND_API_KEY is not configured.');
      return res.status(500).json({
        success: false,
        error: 'Email service is not configured.',
      });
    }

    // This route only sends an email after a successful draft insert; it never bypasses Supabase RLS.
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Resend's development sender works without domain setup for local testing.
    const { data, error } = await resend.emails.send({
      from: 'Lahazaat <onboarding@resend.dev>',
      to: 'mustafa.rajkotwala12@gmail.com',
      subject: 'New Article Draft Submitted',
      html: `
        <p>A new article draft has been submitted!</p>
        <p><strong>Title:</strong> ${articleTitle}</p>
        <p><strong>Author:</strong> ${authorName}</p>
        <p><strong>Author Email:</strong> ${authorEmail}</p>
        <p><a href="http://localhost:3000/admin">Review in Admin Dashboard</a></p>
      `,
    });

    if (error) {
      console.error('Notify API error: Resend send failed.', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send notification email.',
      });
    }

    console.log('Notify API success:', { messageId: data?.id ?? null });

    return res.status(200).json({
      success: true,
      messageId: data?.id ?? null,
    });
  } catch (error) {
    console.error('Notify API error: Unexpected failure.', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error while sending notification email.',
    });
  }
}
