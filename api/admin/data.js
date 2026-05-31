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
    const usersSnap = await db.collection('users').get();
    const userRecords = await Promise.all(usersSnap.docs.map(getUserAdminRecord));
    const users = sortByTimestamp(userRecords, ['createdAt']);

    const wishlistGroups = sortUserGroups(users
      .filter((user) => user._wishlistItems.length > 0)
      .map((user) => buildUserGroup(user, user._wishlistItems, ['updatedAt', 'savedAt', 'createdAt'])));

    const recentFeedback = sortByTimestamp(
      users.flatMap((user) => user._feedback.map((item) => ({
        ...item,
        uid: user.uid,
        email: item.email || user.email
      }))),
      ['createdAt']
    ).slice(0, 25);

    const followedBrandGroups = sortUserGroups(users
      .filter((user) => user._followedBrands.length > 0)
      .map((user) => buildUserGroup(user, user._followedBrands, ['updatedAt', 'subscribedAt'])));

    const brandRequestGroups = sortUserGroups(users
      .filter((user) => user._requestedBrands.length > 0)
      .map((user) => buildUserGroup(user, user._requestedBrands, ['lastRequestedAt', 'updatedAt', 'createdAt'])));

    const payloadUsers = users.map((user) => ({
      uid: user.uid,
      email: user.email,
      createdAt: user.createdAt,
      inviteGateRequired: user.inviteGateRequired,
      inviteCode: user.inviteCode,
      inviteUrl: user.inviteUrl,
      pushNotifications: user.pushNotifications,
      counts: user.counts,
      previews: user.previews
    }));

    const summary = payloadUsers.reduce((totals, user) => ({
      users: totals.users + 1,
      followedBrands: totals.followedBrands + user.counts.followedBrands,
      wishlistItems: totals.wishlistItems + user.counts.wishlistItems,
      requestedBrands: totals.requestedBrands + user.counts.requestedBrands,
      feedback: totals.feedback + user.counts.feedback
    }), {
      users: 0,
      followedBrands: 0,
      wishlistItems: 0,
      requestedBrands: 0,
      feedback: 0
    });

    return setJson(res, 200, {
      ok: true,
      summary,
      users: payloadUsers,
      wishlistGroups,
      followedBrandGroups,
      recentFeedback,
      brandRequestGroups
    });
  } catch (error) {
    return setJson(res, 500, {
      ok: false,
      error: error.message || 'Unable to load Firebase admin data'
    });
  }
};
