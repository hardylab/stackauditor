// POST /api/upload -- accept a screenshot/PDF, validate it, persist it.
//
// Returns an uploadId that /api/audit consumes. Split from /api/audit so the
// browser can show "uploaded" immediately and so a retry of a failed audit does
// not re-upload the file.

import { NextRequest } from 'next/server';
import { mockStatus } from '@/lib/env';
import { isAllowedMimeType, MAX_UPLOAD_BYTES } from '@/lib/limits';
import { createUpload } from '@/lib/repository';
import { jsonError, normaliseEmail } from '@/lib/validation';

// Buffer handling requires Node, not Edge.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Expected multipart/form-data.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError('Missing "file" field.', 400);
  }

  if (!isAllowedMimeType(file.type)) {
    return jsonError(
      'Unsupported file type. Send a PNG, JPEG, WebP, or PDF.',
      415,
      { received: file.type }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError('File too large.', 413, {
      maxBytes: MAX_UPLOAD_BYTES,
      received: file.size,
    });
  }

  if (file.size === 0) {
    return jsonError('File is empty.', 400);
  }

  // Optional at upload time -- the audit step is where email becomes required.
  const email = normaliseEmail(form.get('email'));

  const body = Buffer.from(await file.arrayBuffer());

  try {
    const upload = await createUpload({
      email,
      mimeType: file.type,
      bytes: file.size,
      body,
    });

    return Response.json(
      {
        uploadId: upload.id,
        bytes: upload.bytes,
        mimeType: upload.mimeType,
        mode: mockStatus(),
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return jsonError(message, 500);
  }
}
