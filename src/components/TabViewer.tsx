import type { FileTab } from '../hooks/useOpenTabs';
import { MarkdownPage } from './MarkdownPage';
import { ImageViewer } from './viewers/ImageViewer';
import { PdfViewer } from './viewers/PdfViewer';
import { TextViewer } from './viewers/TextViewer';
import { SheetPreviewer } from './viewers/SheetPreviewer';
import { DocxViewer } from './viewers/DocxViewer';
import { UnsupportedFallback } from './viewers/UnsupportedFallback';

interface Props {
  tab: FileTab;
  /** Workspace root label used by the optional Breadcrumb header. */
  rootName: string;
  /**
   * Breadcrumb click handler. Only Home (index -1) is interactive — it
   * switches to the spreadsheet view. Parent segment clicks are a no-op
   * because the user navigates via the sidebar tree.
   */
  onNavigate: (index: number) => void;
}

/**
 * Route an open tab to the right viewer based on its `kind` (derived from
 * the file extension). Markdown remains a fully-featured editor; every
 * other kind is a read-only viewer.
 */
export function TabViewer({ tab, rootName, onNavigate }: Props) {
  const breadcrumbSegments = [...tab.breadcrumb, tab.label];

  const shellProps = {
    breadcrumb: breadcrumbSegments,
    rootName,
    onNavigate,
  };

  switch (tab.kind) {
    case 'markdown':
      return (
        <MarkdownPage
          key={tab.instanceId ?? tab.key}
          documentIdentity={tab.instanceId ?? tab.key}
          fileHandle={tab.handle}
          fileKey={tab.key}
          label={tab.label}
          breadcrumb={tab.breadcrumb}
          rootName={rootName}
          onNavigate={onNavigate}
        />
      );
    case 'image':
      return <ImageViewer key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
    case 'pdf':
      return <PdfViewer key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
    case 'text':
      return <TextViewer key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
    case 'sheet':
      return <SheetPreviewer key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
    case 'docx':
      return <DocxViewer key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
    case 'unsupported':
    default:
      return <UnsupportedFallback key={tab.key} handle={tab.handle} label={tab.label} {...shellProps} />;
  }
}
