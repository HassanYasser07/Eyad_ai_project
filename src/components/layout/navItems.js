/**
 * EYAD AI — Primary navigation destinations.
 * Single source shared by desktop TopNav and mobile BottomNav so the two
 * stay in sync. Add a destination here once; both navigations pick it up.
 */
export const NAV_ITEMS = [
  { to: "/", key: "nav.home", icon: "Home" },
  { to: "/studios", key: "nav.studios", icon: "LayoutGrid" },
  { to: "/projects", key: "nav.projects", icon: "Folder" },
  { to: "/account", key: "nav.account", icon: "User" },
];

export default NAV_ITEMS;