import { useState } from "react";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { 
  Button 
} from "@/components/ui/button";
import { FullThematicDigest, ThematicSectionWithSourceEmails } from "@/lib/types";
import { getTopicColors, formatTime, getSenderInitials } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Mail
} from "lucide-react";

interface ThematicDigestProps {
  digest: FullThematicDigest;
}

interface ThematicSectionProps {
  section: ThematicSectionWithSourceEmails;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ThematicSection({ section, isExpanded, onToggleExpanded }: ThematicSectionProps) {
  const { bg, text } = getTopicColors(section.theme);

  return (
    <Card className="w-full bg-card rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1 ${bg} ${text} rounded-full text-sm font-medium`}>
              {section.theme}
            </div>
            {section.confidence && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {section.confidence}% confidence
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {isExpanded ? (
              <span className="flex items-center">
                Hide Sources <ChevronUp className="ml-1 h-4 w-4" />
              </span>
            ) : (
              <span className="flex items-center">
                Show Sources <ChevronDown className="ml-1 h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Main thematic summary */}
        <div className="prose dark:prose-invert max-w-none mb-4">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {section.summary}
          </p>
        </div>

        {/* Keywords */}
        {section.keywords && section.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {section.keywords.slice(0, 6).map((keyword, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}

        {/* Source emails (expandable) */}
        <div className={`transition-all duration-300 overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {isExpanded && (
            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Source Emails ({section.sourceEmails.length})
              </h4>
              
              <div className="space-y-3">
                {section.sourceEmails.map((sourceEmail, index) => (
                  <div key={index} className="bg-muted rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium">
                          {getSenderInitials(sourceEmail.email.sender)}
                        </div>
                        <span className="text-gray-600 dark:text-gray-400 truncate">
                          {sourceEmail.email.sender}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(sourceEmail.email.receivedAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {sourceEmail.relevanceScore && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                            {sourceEmail.relevanceScore}% relevant
                          </span>
                        )}
                        {sourceEmail.email.originalLink && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            asChild
                          >
                            <a 
                              href={sourceEmail.email.originalLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              title="View original email"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-1 break-words">
                      {sourceEmail.email.subject}
                    </h5>
                    
                    <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed break-words">
                      {sourceEmail.email.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ThematicDigest({ digest }: ThematicDigestProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (sectionId: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  if (!digest.sections || digest.sections.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          No thematic digest available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          The digest is still processing or no themes were identified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Digest overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 border-blue-200 dark:border-gray-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                Daily Thematic Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {digest.sectionsCount} themes identified from {digest.totalSourceEmails} emails
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Processing Method
              </div>
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 capitalize">
                {digest.processingMethod}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thematic sections */}
      {digest.sections.map((section) => (
        <ThematicSection
          key={section.id}
          section={section}
          isExpanded={expandedSections.has(section.id)}
          onToggleExpanded={() => toggleSection(section.id)}
        />
      ))}
    </div>
  );
}