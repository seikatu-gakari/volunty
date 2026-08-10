import Image from "next/image";
import { lpAssets } from "./lpAssets";

const PHOTO_RADIUS = "rounded-[28%_34%_26%_31%/16%_18%_16%_20%]";

export function HeroPhotoFrame() {
  const photo = lpAssets.heroHighFive;

  return (
    <div
      data-testid="lp-hero-photo-frame"
      className={`relative mx-auto w-full overflow-visible border-[6px] border-white bg-white p-1.5 shadow-xl ring-1 ring-card-border sm:p-2 xl:w-[calc(100%+80px)] ${PHOTO_RADIUS}`}
    >
      <div
        className={`relative overflow-hidden ${PHOTO_RADIUS}`}
      >
        <Image
          alt={photo.alt}
          className={`aspect-[6/5] w-full object-cover lg:aspect-[11/10] ${PHOTO_RADIUS}`}
          height={photo.height}
          priority
          sizes="(min-width: 1280px) 640px, (min-width: 1024px) 48vw, 100vw"
          src={photo.src}
          style={{ objectPosition: photo.objectPosition }}
          width={photo.width}
        />
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[3%] right-[14%] h-3 w-7 rotate-45 rounded-sm bg-primary sm:h-4 sm:w-9"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[1%] right-[7%] size-4 rounded-full bg-pop-teal sm:size-5"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[4%] right-0 size-7 rounded-full border-[5px] border-pop-purple bg-transparent sm:size-8"
      />
    </div>
  );
}
