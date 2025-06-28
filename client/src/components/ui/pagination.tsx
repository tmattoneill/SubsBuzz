import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange 
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const visiblePages = [];
    
    // Always show first page
    visiblePages.push(1);
    
    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      visiblePages.push(i);
    }
    
    // Always show last page if there are more than 1 page
    if (totalPages > 1) {
      visiblePages.push(totalPages);
    }
    
    // Add ellipsis indicators
    const result = [];
    let prev = 0;
    
    for (const page of visiblePages) {
      if (page - prev > 1) {
        result.push(-1); // Use -1 to indicate ellipsis
      }
      result.push(page);
      prev = page;
    }
    
    return result;
  };

  return (
    <div className="mt-8 flex justify-between items-center">
      <div className="text-sm text-gray-500">
        Showing <span className="font-medium">{startItem}-{endItem}</span> of{" "}
        <span className="font-medium">{totalItems}</span> digests
      </div>
      <div className="flex space-x-1">
        <Button
          variant="outline"
          size="icon"
          className="px-3 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {getPageNumbers().map((page, index) => 
          page === -1 ? (
            <span key={`ellipsis-${index}`} className="px-3 py-1">...</span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              className={`px-3 py-1 rounded border ${
                currentPage === page
                  ? "bg-primary text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="px-3 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
