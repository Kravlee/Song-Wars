const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function sanitizeFilename(filename) {
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

function buildUniquePath(filename) {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  return `${timestamp}_${sanitized}`;
}

async function uploadBeat(buffer, filename, mimetype) {
  const path = buildUniquePath(filename);

  const { error } = await supabase.storage
    .from('beats')
    .upload(path, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload beat: ${error.message}`);
  }

  const { data } = supabase.storage.from('beats').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadSubmission(buffer, filename, mimetype) {
  const path = buildUniquePath(filename);

  const { error } = await supabase.storage
    .from('submissions')
    .upload(path, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload submission: ${error.message}`);
  }

  const { data } = supabase.storage.from('submissions').getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { uploadBeat, uploadSubmission };
