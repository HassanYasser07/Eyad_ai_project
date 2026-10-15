/**
 * Maps registry icon keys to lucide-react icons.
 */
import {
  Shapes,
  Palette,
  BriefcaseBusiness,
  Presentation,
  Image,
  Video,
  Store,
  LayoutTemplate,
} from "lucide-react";

export const studioIcons = {
  Shapes,
  Palette,
  BriefcaseBusiness,
  Presentation,
  Image,
  Video,
  Store,
  LayoutTemplate,
};

export const getStudioIcon = (key) => studioIcons[key] || Shapes;

export default studioIcons;