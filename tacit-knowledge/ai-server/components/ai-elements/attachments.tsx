"use client";

import { cn } from "@/lib/utils";
import type { FileUIPart } from "ai";
import { FileIcon, ImageIcon, XIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  useContext,
  type ReactNode,
} from "react";

// ============================================================================
// Types
// ============================================================================

export type AttachmentData = FileUIPart & { id: string };

type AttachmentContextValue = {
  data: AttachmentData;
  onRemove?: () => void;
};

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

function useAttachment() {
  const context = useContext(AttachmentContext);
  if (!context) {
    throw new Error("Attachment components must be used within an Attachment");
  }
  return context;
}

// ============================================================================
// Attachments Container
// ============================================================================

export type AttachmentsProps = ComponentProps<"div"> & {
  variant?: "grid" | "list" | "inline";
};

export const Attachments = ({
  className,
  variant = "grid",
  ...props
}: AttachmentsProps) => {
  const variantStyles = {
    grid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2",
    list: "flex flex-col gap-2",
    inline: "flex flex-wrap gap-2",
  };

  return (
    <div className={cn(variantStyles[variant], className)} {...props} />
  );
};

// ============================================================================
// Attachment Item
// ============================================================================

export type AttachmentProps = ComponentProps<"div"> & {
  data: AttachmentData;
  onRemove?: () => void;
  children?: ReactNode;
};

export const Attachment = ({
  data,
  onRemove,
  className,
  children,
  ...props
}: AttachmentProps) => {
  return (
    <AttachmentContext.Provider value={{ data, onRemove }}>
      <div
        className={cn(
          "group relative flex w-40 flex-col overflow-hidden rounded-lg border bg-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
};

// ============================================================================
// Attachment Preview
// ============================================================================

export type AttachmentPreviewProps = ComponentProps<"div">;

export const AttachmentPreview = ({
  className,
  ...props
}: AttachmentPreviewProps) => {
  const { data } = useAttachment();
  const isImage = data.mediaType?.startsWith("image/");

  if (isImage && data.url) {
    return (
      <div
        className={cn("relative aspect-square overflow-hidden", className)}
        {...props}
      >
        <img
          src={data.url}
          alt={data.filename || "attachment"}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center bg-muted",
        className
      )}
      {...props}
    >
      <FileIcon className="size-8 text-muted-foreground" />
    </div>
  );
};

// ============================================================================
// Attachment Info
// ============================================================================

export type AttachmentInfoProps = ComponentProps<"div">;

export const AttachmentInfo = ({ className, ...props }: AttachmentInfoProps) => {
  const { data } = useAttachment();

  return (
    <div className={cn("p-2", className)} {...props}>
      <p className="truncate text-sm font-medium">
        {data.filename || "Untitled"}
      </p>
      {data.mediaType && (
        <p className="truncate text-xs text-muted-foreground">
          {data.mediaType}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Attachment Remove Button
// ============================================================================

export type AttachmentRemoveProps = ComponentProps<"button">;

export const AttachmentRemove = ({
  className,
  ...props
}: AttachmentRemoveProps) => {
  const { onRemove } = useAttachment();

  if (!onRemove) return null;

  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100",
        className
      )}
      {...props}
    >
      <XIcon className="size-4" />
    </button>
  );
};
