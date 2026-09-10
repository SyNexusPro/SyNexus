import { ADSENSE_HOME_SLOT } from "../config/adsense";
import { AdSenseUnit } from "./AdSenseUnit";

/** Home feed display ad — below scan / movers. */
export function HomeAdSense() {
  return <AdSenseUnit slot={ADSENSE_HOME_SLOT} className="adsense-unit--home" />;
}
