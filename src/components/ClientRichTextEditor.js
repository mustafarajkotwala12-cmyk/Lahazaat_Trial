import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

function ensureFindDomNode() {
  if (typeof ReactDOM.findDOMNode === 'function') {
    return;
  }

  ReactDOM.findDOMNode = (instance) => {
    if (!instance) {
      return null;
    }

    if (typeof instance.nodeType === 'number') {
      return instance;
    }

    return null;
  };
}

export default function ClientRichTextEditor({ className = '', ...props }) {
  const [EditorComponent, setEditorComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadEditor() {
      try {
        ensureFindDomNode();

        const quillModule = await import('react-quill');

        if (!isActive) {
          return;
        }

        setEditorComponent(() => quillModule.default);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Rich text editor load error:', error);
        setLoadError('Unable to load the editor right now.');
      }
    }

    loadEditor();

    return () => {
      isActive = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="rounded border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
        {loadError}
      </div>
    );
  }

  if (!EditorComponent) {
    return (
      <div className="rounded-lg border border-gray-300 bg-white px-4 py-6 text-sm text-gray-500">
        Loading editor...
      </div>
    );
  }

  return <EditorComponent className={className} {...props} />;
}
