import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface Topic {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface TopicNavProps {
  topics: Topic[];
  selectedTopic: string;
  onSelectTopic: (topicId: string) => void;
}

export function TopicNav({ topics, selectedTopic, onSelectTopic }: TopicNavProps) {
  return (
    <div className="border-t border-border overflow-x-auto">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center gap-2 py-4">
          {topics.map((topic, index) => {
            const Icon = topic.icon;
            const isSelected = selectedTopic === topic.id;

            return (
              <motion.button
                key={topic.id}
                type="button"
                onClick={() => onSelectTopic(topic.id)}
                className={`
                  relative px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2
                  font-body transition-colors
                  ${
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-foreground/70 hover:text-foreground hover:bg-secondary/50'
                  }
                `}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSelected && (
                  <motion.div
                    layoutId="topic-indicator"
                    className="absolute inset-0 bg-accent rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-4 relative z-10" />
                <span className="text-sm font-medium relative z-10">{topic.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
