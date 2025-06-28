import { useState } from "react";
import { Topic } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getTopicColors } from "@/lib/utils";

interface TopicFilterProps {
  topics: Topic[];
  onTopicSelect: (topicName: string) => void;
}

export function TopicFilter({ topics, onTopicSelect }: TopicFilterProps) {
  const [showAllTopics, setShowAllTopics] = useState(false);
  
  const visibleTopics = showAllTopics ? topics : topics.slice(0, 6);
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold dark:text-white">Popular Topics</h2>
        <Button 
          variant="link" 
          className="text-sm text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={() => setShowAllTopics(!showAllTopics)}
        >
          {showAllTopics ? "Show Less" : "View All"}
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {visibleTopics.map((topic) => {
          const colorStyles = getTopicColors(topic.name);
          return (
            <Button
              key={topic.name}
              variant="outline"
              className={`tag px-3 py-1 ${
                topic.isSelected 
                  ? `${colorStyles.bg} ${colorStyles.text} dark:bg-opacity-30` 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              } rounded-full text-sm font-medium hover:bg-opacity-80 transition-all border-none`}
              onClick={() => onTopicSelect(topic.name)}
            >
              {topic.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
