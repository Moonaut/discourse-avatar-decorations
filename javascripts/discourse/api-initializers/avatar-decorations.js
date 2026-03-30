import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";

// Map to cache user API responses so we only fetch a user's profile once per session
const avatarDecorationCache = new Map();

async function getDecorationUrl(username, fieldId) {
  if (avatarDecorationCache.has(username)) {
    return avatarDecorationCache.get(username);
  }

  try {
    // Fetch directly via AJAX to bypass Ember Data and prevent the "timezone" deprecation warning
    const response = await ajax(`/u/${username}.json`);
    
    // Extract the user field
    const url = response?.user?.user_fields?.[fieldId.toString()] ?? null;
    
    avatarDecorationCache.set(username, url);
    return url;
  } catch (error) {
    // If the fetch fails (e.g., user deleted, or profile is strictly hidden), cache null
    avatarDecorationCache.set(username, null);
    return null;
  }
}

export default apiInitializer("1.8.0", (api) => {
  const fieldId = settings.user_field_id;
  if (!fieldId) return;

  api.decorateCooked(
    async (cooked, helper) => {
      // FIX: Unwrap jQuery object if present to get the raw HTML element
      const element = cooked.jquery ? cooked[0] : cooked;
      
      // Ensure element exists and we are inside a post context
      if (!element || !helper?.getModel) return;
      
      const post = helper.getModel();
      if (!post?.username) return;

      const url = await getDecorationUrl(post.username, fieldId);
      if (!url) return;

      // Safely traverse the DOM using native element methods
      const topicPost = element.closest ? element.closest(".topic-post") : null;
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