import { describe, expect, it } from "vitest";
import { licensesIn, pageText, parseStory, readingSeconds, storyweaverRights } from "../../src/connectors/storyweaver";
import { storyweaverBook } from "../fixtures/sources";

describe("StoryWeaver connector", () => {
  it("keeps only a page's visible story text", () => {
    expect(pageText("<p><span>Hello</span> <b>Manu</b>&nbsp;&amp; Ma.</p><div>3/10</div><script>var x = 1;</script>")).toBe("Hello Manu & Ma.");
  });

  it("reads the story pages, the credits and every license on the attribution page", () => {
    const { story, licenses } = parseStory(storyweaverBook(1).pages);
    expect(story.pages).toEqual([
      { page: 1, text: "On Sunday, Manu's parents got him a red raincoat.", image_url: expect.stringContaining("/size4/"), image_small_url: expect.stringContaining("/size3/") },
      { page: 2, text: "At last it rained, and Manu danced.", image_url: expect.stringContaining("/size4/"), image_small_url: expect.stringContaining("/size3/") },
    ]);
    expect(story.credits).toContain("Story Attribution");
    expect(licenses).toEqual(["CC BY 4.0"]);
    expect(licensesIn("Released under CC BY-NC-ND 4.0 license. Released under CC BY 4.0 license.")).toEqual(["CC BY-NC-ND 4.0", "CC BY 4.0"]);
  });

  it("stores a story only when every license is open, with full attribution", () => {
    const { hit } = storyweaverBook(1);
    expect(storyweaverRights(hit, "credits", ["CC BY 4.0"])).toMatchObject({
      licenseName: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attributionText: "Source: StoryWeaver by Pratham Books · Written by Kiran Kasturia · Illustrated by Zainab Tambawalla · Licensed under CC BY 4.0",
      attributionRequired: true,
      allowsMediaStorage: true,
    });
    expect(storyweaverRights(hit, "credits", ["CC BY 4.0", "CC BY-NC-ND 4.0"])).toBeNull();
    expect(storyweaverRights(hit, "credits", [])).toBeNull();
  });

  it("estimates read-aloud time", () => {
    const { story } = parseStory(storyweaverBook(1).pages);
    expect(readingSeconds(story.pages)).toBe(60);
    expect(readingSeconds([{ page: 1, text: "word ".repeat(300).trim(), image_url: null, image_small_url: null }])).toBe(185);
  });
});
