const { requireAuth, parseJsonBody, setJson } = require('../_admin');
const { getFirestore } = require('../_firebase');

const COLLECTION_NAME = 'adminInviteCampaigns';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapCampaign(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    label: data.label || doc.id,
    slug: data.slug || doc.id,
    active: data.active !== false,
    createdBy: data.createdBy || '',
    createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
      ? data.createdAt.toDate().toISOString()
      : null
  };
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const db = getFirestore();
    const collection = db.collection(COLLECTION_NAME);

    if (req.method === 'GET') {
      const snapshot = await collection.get();
      const campaigns = snapshot.docs
        .map(mapCampaign)
        .sort((left, right) => {
          if (left.active !== right.active) {
            return left.active ? -1 : 1;
          }

          return String(left.label).localeCompare(String(right.label));
        });

      return setJson(res, 200, {
        ok: true,
        campaigns
      });
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req.body);
      const label = String(body.label || '').trim();
      const createdBy = String(body.createdBy || '').trim();
      const active = body.active !== false;

      if (!label) {
        return setJson(res, 400, {
          ok: false,
          error: 'Campaign label is required'
        });
      }

      const slug = slugify(body.slug || label);

      if (!slug) {
        return setJson(res, 400, {
          ok: false,
          error: 'Campaign slug is invalid'
        });
      }

      const ref = collection.doc(slug);
      const existing = await ref.get();

      if (existing.exists) {
        return setJson(res, 409, {
          ok: false,
          error: 'Campaign already exists'
        });
      }

      await ref.set({
        label,
        slug,
        active,
        createdBy,
        createdAt: new Date()
      });

      return setJson(res, 200, {
        ok: true,
        campaign: {
          id: slug,
          label,
          slug,
          active,
          createdBy,
          createdAt: new Date().toISOString()
        }
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return setJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    return setJson(res, 500, {
      ok: false,
      error: error.message || 'Unable to manage invite campaigns'
    });
  }
};
