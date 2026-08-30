import Image from "next/image";
import { lpAssets } from "./lpAssets";

const PHOTO_RADIUS = "rounded-[28%_34%_26%_31%/16%_18%_16%_20%]";

export function HeroPhotoFrame() {
  const photo = lpAssets.heroHighFive;

  return (
    <div
      data-testid="lp-hero-photo-frame"
      className={`mx-auto w-full border-[6px] border-white bg-white p-1.5 shadow-xl ring-1 ring-card-border sm:p-2 xl:w-[calc(100%+80px)] ${PHOTO_RADIUS}`}
    >
      <div
        className={`relative overflow-hidden ${PHOTO_RADIUS}`}
      >
        <Image
          alt={photo.alt}
          className={`aspect-[6/5] w-full object-cover lg:aspect-[11/10] ${PHOTO_RADIUS}`}
          height={photo.height}
          priority
          sizes="(min-width: 1280px) 768px, (min-width: 1024px) 48vw, 100vw"
          src={photo.src}
          style={{ objectPosition: photo.objectPosition }}
          width={photo.width}
        />
      </div>
    </div>
  );
}
