import { apiInitializer } from "discourse/lib/api";

// Map to cache user API responses so we only fetch a user's profile once per session
const avatarDecorationCache = new Map();

async function getDecorationUrl(username, store, fieldId) {
  if (avatarDecorationCache.has(username)) {
    return avatarDecorationCache.get(username);
  }

  try {
    // Fetch user profile data
    const user = await store.find("user", username);
    
    // Discourse stores custom fields in the user_fields object keyed by their ID string
    const url = user.user_fields?.[fieldId.toString()] ?? null;
    
    avatarDecorationCache.set(username, url);
    return url;
  } catch (error) {
    // If the fetch fails (e.g., user deleted), cache null to prevent infinite retries
    avatarDecorationCache.set(username, null);
    return null;
  }
}

export default apiInitializer("1.8.0", (api) => {
  const fieldId = settings.user_field_id;
  if (!fieldId) return;

  api.decorateCooked(
    async (cooked, helper) => {
      // Ensure we are inside a post context
      if (!helper?.getModel) return;
      const post = helper.getModel();
      if (!post?.username) return;

      const store = api.container.lookup("service:store");
      const url = await getDecorationUrl(post.username, store, fieldId);
      if (!url) return;

      // Find the specific post container in the DOM
      const topicPost = cooked.closest(".topic-post");
      if (!topicPost) return;

      const avatarWrapper = topicPost.querySelector(".post-avatar");
      if (!avatarWrapper) return;

      // Inject the decoration URL as a CSS variable and flag it with a class
      avatarWrapper.style.setProperty("--post-avatar-decoration", `url("${url}")`);
      avatarWrapper.classList.add("has-avatar-decoration");
    },
    { id: "custom-avatar-decorations" }
  );
});