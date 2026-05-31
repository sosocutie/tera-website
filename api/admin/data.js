const { requireAuth, setJson } = require('../_admin');
const { getFirestore } = require('../_firebase');

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampToIso(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : null;
}

function getTimestampFromKeys(item, keys) {
  return keys.reduce((found, key) => found || timestampToMillis(item[key]), 0);
}

function sortByTimestamp(items, keys) {
  return [...items].sort((left, right) => {
    const leftValue = getTimestampFromKeys(left, keys);
    const rightValue = getTimestampFromKeys(right, keys);
    return rightValue - leftValue;
  });
}

function mapPushNotifications(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    enabled: Boolean(source.enabled),
    permissionStatus: source.permissionStatus || '',
    platform: source.platform || '',
    updatedAt: timestampToIso(source.updatedAt)
  };
}

function mapFollowedBrand(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    brandId: data.brandId || data.brandID || doc.id,
    brandName: data.brandName || '',
    siteUrl: data.siteUrl || '',
    salesEnabled: Boolean(data.salesEnabled),
    allUpdatesEnabled: Boolean(data.allUpdatesEnabled),
    subscribedAt: timestampToIso(data.subscribedAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function mapWishlistItem(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    name: data.name || '',
    brand: data.brand || '',
    brandId: data.brandId || '',
    productUrl: data.productUrl || data.url || '',
    imageUrl: data.imageUrl || '',
    currentPrice: data.currentPrice || data.price || '',
    selectedSize: data.selectedSize || '',
    source: data.source || '',
    isBought: Boolean(data.isBought),
    savedAt: timestampToIso(data.savedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function mapRequestedBrand(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    brandName: data.brandName || '',
    canonicalBrandId: data.canonicalBrandId || '',
    siteUrl: data.siteUrl || '',
    siteHost: data.siteHost || '',
    source: data.source || '',
    status: data.status || '',
    requestCount: Number(data.requestCount || 0),
    requestedBrandNames: Array.isArray(data.requestedBrandNames) ? data.requestedBrandNames : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    createdAt: timestampToIso(data.createdAt),
    lastRequestedAt: timestampToIso(data.lastRequestedAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function mapFeedback(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    uid: data.uid || '',
    email: data.email || '',
    message: data.message || '',
    platform: data.platform || '',
    screen: data.screen || '',
    screenLabel: data.screenLabel || '',
    status: data.status || '',
    imageUrl: data.imageUrl || '',
    createdAt: timestampToIso(data.createdAt)
  };
}

function mapUser(doc) {
  const data = doc.data() || {};

  return {
    uid: data.uid || doc.id,
    email: data.email || '',
    createdAt: timestampToIso(data.createdAt),
    inviteGateRequired: Boolean(data.inviteGateRequired),
    inviteCode: data.inviteCode || '',
    inviteUrl: data.inviteUrl || '',
    pushNotifications: mapPushNotifications(data.pushNotifications)
  };
}

function buildUserGroup(user, items, keys) {
  const sortedItems = sortByTimestamp(items, keys);
  const latestActivityMillis = sortedItems.length ? getTimestampFromKeys(sortedItems[0], keys) : 0;

  return {
    uid: user.uid,
    email: user.email,
    latestActivityAt: latestActivityMillis ? new Date(latestActivityMillis).toISOString() : null,
    items: sortedItems
  };
}

function sortUserGroups(groups) {
  return [...groups].sort((left, right) => {
    return timestampToMillis(right.latestActivityAt) - timestampToMillis(left.latestActivityAt);
  });
}

function getSection(req) {
  const url = new URL(req.url || '/api/admin/data', 'http://localhost');
  return url.searchParams.get('section') || 'users';
}

async function getSummary(db) {
  const [
    usersAgg,
    wishlistAgg,
    followedAgg,
    feedbackAgg,
    requestsAgg
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collectionGroup('wishlistItems').count().get(),
    db.collectionGroup('followedBrands').count().get(),
    db.collectionGroup('feedback').count().get(),
    db.collectionGroup('requestedBrands').count().get()
  ]);

  return {
    users: usersAgg.data().count || 0,
    wishlistItems: wishlistAgg.data().count || 0,
    followedBrands: followedAgg.data().count || 0,
    feedback: feedbackAgg.data().count || 0,
    requestedBrands: requestsAgg.data().count || 0
  };
}

function getParentUid(doc) {
  return doc.ref.parent && doc.ref.parent.parent ? doc.ref.parent.parent.id : '';
}

async function getUsersMap(db) {
  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map(mapUser);
  const byUid = new Map(users.map((user) => [user.uid, user]));

  return {
    users: sortByTimestamp(users, ['createdAt']),
    byUid
  };
}

function attachUser(item, usersByUid, uid) {
  const user = usersByUid.get(uid) || {};

  return {
    ...item,
    uid,
    email: user.email || ''
  };
}

async function getUserAdminRecord(userDoc) {
  const data = userDoc.data() || {};
  const userRef = userDoc.ref;

  const [
    followedBrandsSnap,
    wishlistItemsSnap,
    requestedBrandsSnap,
    feedbackSnap
  ] = await Promise.all([
    userRef.collection('followedBrands').get(),
    userRef.collection('wishlistItems').get(),
    userRef.collection('requestedBrands').get(),
    userRef.collection('feedback').get()
  ]);

  const followedBrands = sortByTimestamp(
    followedBrandsSnap.docs.map(mapFollowedBrand),
    ['updatedAt', 'subscribedAt']
  );
  const wishlistItems = sortByTimestamp(
    wishlistItemsSnap.docs.map(mapWishlistItem),
    ['updatedAt', 'savedAt', 'createdAt']
  );
  const requestedBrands = sortByTimestamp(
    requestedBrandsSnap.docs.map(mapRequestedBrand),
    ['lastRequestedAt', 'updatedAt', 'createdAt']
  );
  const feedback = sortByTimestamp(
    feedbackSnap.docs.map(mapFeedback),
    ['createdAt']
  );

  return {
    uid: data.uid || userDoc.id,
    email: data.email || '',
    createdAt: timestampToIso(data.createdAt),
    inviteGateRequired: Boolean(data.inviteGateRequired),
    inviteCode: data.inviteCode || '',
    inviteUrl: data.inviteUrl || '',
    pushNotifications: mapPushNotifications(data.pushNotifications),
    counts: {
      followedBrands: followedBrands.length,
      wishlistItems: wishlistItems.length,
      requestedBrands: requestedBrands.length,
      feedback: feedback.length
    },
    previews: {
      followedBrands: followedBrands.slice(0, 5),
      wishlistItems: wishlistItems.slice(0, 4),
      requestedBrands: requestedBrands.slice(0, 4),
      feedback: feedback.slice(0, 2)
    },
    _followedBrands: followedBrands,
    _wishlistItems: wishlistItems,
    _requestedBrands: requestedBrands,
    _feedback: feedback
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return setJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const db = getFirestore();
    const section = getSection(req);
    const summary = await getSummary(db);

    if (section === 'users') {
      const { users } = await getUsersMap(db);

      return setJson(res, 200, {
        ok: true,
        summary,
        section,
        users
      });
    }

    const { byUid } = await getUsersMap(db);

    if (section === 'wishlist') {
      const snap = await db.collectionGroup('wishlistItems').get();
      const items = sortByTimestamp(
        snap.docs.map((doc) => attachUser(mapWishlistItem(doc), byUid, getParentUid(doc))),
        ['updatedAt', 'savedAt', 'createdAt']
      );

      const groups = sortUserGroups(
        Array.from(items.reduce((acc, item) => {
          if (!acc.has(item.uid)) {
            acc.set(item.uid, {
              uid: item.uid,
              email: item.email,
              items: []
            });
          }

          acc.get(item.uid).items.push(item);
          return acc;
        }, new Map()).values()).map((group) => buildUserGroup(group, group.items, ['updatedAt', 'savedAt', 'createdAt']))
      );

      return setJson(res, 200, {
        ok: true,
        summary,
        section,
        wishlistGroups: groups
      });
    }

    if (section === 'followed') {
      const snap = await db.collectionGroup('followedBrands').get();
      const items = sortByTimestamp(
        snap.docs.map((doc) => attachUser(mapFollowedBrand(doc), byUid, getParentUid(doc))),
        ['updatedAt', 'subscribedAt']
      );

      const groups = sortUserGroups(
        Array.from(items.reduce((acc, item) => {
          if (!acc.has(item.uid)) {
            acc.set(item.uid, {
              uid: item.uid,
              email: item.email,
              items: []
            });
          }

          acc.get(item.uid).items.push(item);
          return acc;
        }, new Map()).values()).map((group) => buildUserGroup(group, group.items, ['updatedAt', 'subscribedAt']))
      );

      return setJson(res, 200, {
        ok: true,
        summary,
        section,
        followedBrandGroups: groups
      });
    }

    if (section === 'requests') {
      const snap = await db.collectionGroup('requestedBrands').get();
      const items = sortByTimestamp(
        snap.docs.map((doc) => attachUser(mapRequestedBrand(doc), byUid, getParentUid(doc))),
        ['lastRequestedAt', 'updatedAt', 'createdAt']
      );

      const groups = sortUserGroups(
        Array.from(items.reduce((acc, item) => {
          if (!acc.has(item.uid)) {
            acc.set(item.uid, {
              uid: item.uid,
              email: item.email,
              items: []
            });
          }

          acc.get(item.uid).items.push(item);
          return acc;
        }, new Map()).values()).map((group) => buildUserGroup(group, group.items, ['lastRequestedAt', 'updatedAt', 'createdAt']))
      );

      return setJson(res, 200, {
        ok: true,
        summary,
        section,
        brandRequestGroups: groups
      });
    }

    if (section === 'feedback') {
      const snap = await db.collectionGroup('feedback').get();
      const items = sortByTimestamp(
        snap.docs.map((doc) => {
          const item = mapFeedback(doc);
          const uid = getParentUid(doc);
          const user = byUid.get(uid) || {};

          return {
            ...item,
            uid,
            email: item.email || user.email || ''
          };
        }),
        ['createdAt']
      ).slice(0, 50);

      return setJson(res, 200, {
        ok: true,
        summary,
        section,
        recentFeedback: items
      });
    }

    return setJson(res, 400, {
      ok: false,
      error: 'Unknown admin section'
    });
  } catch (error) {
    return setJson(res, 500, {
      ok: false,
      error: error.message || 'Unable to load Firebase admin data'
    });
  }
};
