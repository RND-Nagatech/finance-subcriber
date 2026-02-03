import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const UpdateLog: React.FC = () => {
  const [changelog, setChangelog] = useState<string>('');

  useEffect(() => {
    fetch('/CHANGELOG.md')
      .then(response => response.text())
      .then(text => setChangelog(text))
      .catch(error => console.error('Error loading changelog:', error));
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Update Log</h1>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {changelog}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default UpdateLog;