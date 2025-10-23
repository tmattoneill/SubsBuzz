import { useState } from "react";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { 
  Button 
} from "@/components/ui/button";
import { DigestEmail } from "@/lib/types";
import { getTopicColors, formatTime, getSenderInitials } from "@/lib/utils";
import { 
  Star, 
  StarOff,
  ExternalLink, 
  ChevronDown, 
  ChevronUp 
} from "lucide-react";

interface DigestCardProps {
  email: DigestEmail;
  onToggleFavorite?: (id: number) => void;
}

export function DigestCard({ email, onToggleFavorite }: DigestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    if (onToggleFavorite) {
      onToggleFavorite(email.id);
    }
  };

  const receivedTime = formatTime(email.receivedAt);

  return (
    <Card className="digest-card bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 w-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-primary text-xs font-medium">
                {getSenderInitials(email.sender)}
              </div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{email.sender}</span>
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{receivedTime}</span>
            </div>
            <h3 
              className="text-lg font-semibold cursor-pointer hover:text-primary dark:text-white break-words"
              onClick={toggleExpanded}
            >
              {email.subject}
            </h3>
          </div>
          <div className="flex space-x-2 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon"
              className={`p-1.5 ${isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'} rounded`}
              onClick={toggleFavorite}
            >
              {isFavorite ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
            </Button>
            {email.originalLink && (
              <Button
                variant="ghost"
                size="icon"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                asChild
              >
                <a href={email.originalLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          {email.topics.map((topic, index) => {
            const { bg, text } = getTopicColors(topic);
            return (
              <span key={index} className={`tag px-2 py-0.5 ${bg} ${text} rounded-full text-xs font-medium`}>
                {topic}
              </span>
            );
          })}
        </div>
        
        <div className="mt-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed break-words">
          {email.summary}
        </div>
        
        <div className={`mt-4 border-t dark:border-gray-700 pt-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[1000px]' : 'max-h-0 border-t-0 pt-0 mt-0'}`}>
          <div className="break-words" dangerouslySetInnerHTML={{ __html: email.fullContent.replace(/\n/g, '<br/>') }} />
          
          {email.originalLink && (
            <div className="mt-4">
              <a 
                href={email.originalLink} 
                className="text-primary hover:underline font-medium text-sm inline-flex items-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Read full article</span>
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          onClick={toggleExpanded}
        >
          {isExpanded ? (
            <span className="flex items-center">Show less <ChevronUp className="ml-1 h-3 w-3" /></span>
          ) : (
            <span className="flex items-center">Show more <ChevronDown className="ml-1 h-3 w-3" /></span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
