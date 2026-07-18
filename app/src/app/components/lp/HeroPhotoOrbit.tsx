import Image from "next/image";
import { lpAssets } from "./lpAssets";

const SATELLITE_PHOTOS = [
  {
    key: "event",
    image: lpAssets.styleMediator,
    frameClassName:
      "absolute right-[1%] top-[1%] z-20 aspect-square w-[28%] overflow-hidden rounded-full border-[5px] border-white shadow-lg lg:right-0 lg:top-[2%] lg:w-[29%]",
    objectPosition: "50% 44%",
  },
  {
    key: "nature",
    image: lpAssets.styleExplorer,
    frameClassName:
      "absolute right-0 top-[34%] z-20 aspect-[4/5] w-[31%] overflow-hidden rounded-[48%_52%_45%_55%/42%_47%_53%_58%] border-[5px] border-white shadow-lg lg:right-[1%] lg:top-[34%] lg:w-[30%]",
    objectPosition: "50% 45%",
  },
  {
    key: "thanks",
    image: lpAssets.benefitThanks,
    frameClassName:
      "absolute bottom-[1%] left-[1%] z-20 aspect-square w-[27%] overflow-hidden rounded-full border-[5px] border-white shadow-lg lg:bottom-[2%] lg:left-[2%] lg:w-[28%]",
    objectPosition: "50% 44%",
  },
  {
    key: "organization",
    image: lpAssets.voiceOrganization,
    frameClassName:
      "absolute right-[4%] bottom-0 z-20 aspect-[5/4] w-[29%] overflow-hidden rounded-[52%_48%_55%_45%/46%_54%_46%_54%] border-[5px] border-white shadow-lg lg:right-[3%] lg:bottom-[1%] lg:w-[30%]",
    objectPosition: "50% 48%",
  },
] as const;

export function HeroPhotoOrbit() {
  const main = lpAssets.heroCleanup;

  return (
    <div
      data-testid="lp-hero-photo-orbit"
      className="relative mx-auto aspect-square w-full max-w-xl lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-w-none"
    >
      <div className="absolute top-[17%] left-[8%] z-10 w-[84%] overflow-hidden rounded-[42%_58%_46%_54%/24%_32%_68%_76%] bg-white p-1.5 shadow-xl ring-1 ring-card-border lg:top-[17%] lg:left-[7%] lg:w-[76%] lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]">
        <Image
          alt={main.alt}
          className="aspect-[4/3] w-full rounded-[42%_58%_46%_54%/24%_32%_68%_76%] object-cover lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]"
          height={main.height}
          priority
          sizes="(min-width: 1280px) 510px, (min-width: 1024px) 38vw, (min-width: 640px) 576px, 84vw"
          src={main.src}
          style={{ objectPosition: main.objectPosition }}
          width={main.width}
        />
      </div>

      {SATELLITE_PHOTOS.map((photo) => (
        <div key={photo.key} className={photo.frameClassName}>
          <Image
            alt={photo.image.alt}
            className="h-full w-full object-cover"
            height={photo.image.height}
            sizes="(min-width: 1280px) 200px, (min-width: 1024px) 15vw, 31vw"
            src={photo.image.src}
            style={{ objectPosition: photo.objectPosition }}
            width={photo.image.width}
          />
        </div>
      ))}
    </div>
  );
}
