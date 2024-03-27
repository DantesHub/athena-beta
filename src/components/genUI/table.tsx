/**
 * v0 by Vercel.
 * @see https://v0.dev/t/E3n8MEA2mLk
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { TableHead, TableRow, TableHeader, TableCell, TableBody, Table } from "@/components/ui/table"
import { QueryResult } from "@/lib/chat/actions";

export default function GenTable({ files }: { files: QueryResult[] }) {
  const formatAuthor = (author: string) => {
    return author?.replace(/[\[\]@]/g, '');
  };

  const formatTitle = (title: string) => {
    return decodeURIComponent(title).replace(/^B\$\s*/, '');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="dark bg-black">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2 text-white">Title</TableHead>
            <TableHead className="w-1/6 text-white">Author</TableHead>
            <TableHead className="w-1/6 text-white">Date Created</TableHead>
            <TableHead className="w-1/6 text-white">Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const metadata = JSON.parse(file.metadata);
            const author = formatAuthor(metadata.Author);
            const created = formatDate(metadata.Created);
            const rating = metadata.rating;

            if (!author && !rating) return null;

            return (
              <TableRow key={file._id}>
                <TableCell className="font-bold text-white w-1/2">{formatTitle(file.url_path)}</TableCell>
                <TableCell className="text-white w-1/6">{author}</TableCell>
                <TableCell className="text-white w-1/6">{created}</TableCell>
                <TableCell className="text-white w-1/6">{rating}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  )
}