import { describe, it, expect } from "vitest";
import { parseUpdate } from "@/lib/telegram/updates";

describe("parseUpdate", () => {
  it("classifies text / link / voice / photo / forward and callbacks", () => {
    expect(parseUpdate({ message: { message_id: 1, chat: { id: 5 }, text: "идея про команду" } })).toEqual({
      message: { kind: "text", tgChatId: "5", tgMessageId: 1, text: "идея про команду", tgFileId: null, mediaRef: null },
    });
    const link = parseUpdate({ message: { message_id: 2, chat: { id: 5 }, text: "https://drive.google.com/x", entities: [{ type: "url", offset: 0, length: 26 }] } });
    expect(link).toMatchObject({ message: { kind: "link", mediaRef: "https://drive.google.com/x", text: "https://drive.google.com/x" } });
    // text + link → still text, but mediaRef captured
    const mixed = parseUpdate({ message: { message_id: 7, chat: { id: 5 }, text: "кадры тут https://drive.google.com/y", entities: [{ type: "url", offset: 10, length: 26 }] } });
    expect(mixed).toMatchObject({ message: { kind: "text", mediaRef: "https://drive.google.com/y" } });
    expect(parseUpdate({ message: { message_id: 3, chat: { id: 5 }, voice: { file_id: "F1", duration: 12 } } })).toMatchObject({ message: { kind: "voice", tgFileId: "F1", text: null } });
    expect(parseUpdate({ message: { message_id: 4, chat: { id: 5 }, caption: "кадр", photo: [{ file_id: "s", width: 90 }, { file_id: "L", width: 1280 }] } })).toMatchObject({ message: { kind: "photo", tgFileId: "L", text: "кадр" } });
    expect(parseUpdate({ message: { message_id: 5, chat: { id: 5 }, text: "x", forward_origin: { type: "channel" } } })).toMatchObject({ message: { kind: "forward" } });
    expect(parseUpdate({ message: { message_id: 6, chat: { id: 5 }, video: { file_id: "V" } } })).toMatchObject({ message: { kind: "video", tgFileId: "V" } });
    expect(parseUpdate({ callback_query: { id: "c1", data: "approve:abc", message: { message_id: 9, chat: { id: 5 } } } })).toEqual({
      callback: { tgChatId: "5", callbackId: "c1", data: "approve:abc", messageId: 9 },
    });
    expect(parseUpdate({ edited_message: {} })).toBeNull();
    expect(parseUpdate(null)).toBeNull();
  });
});
