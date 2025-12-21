/**
 * EmberFlowsPage - Admin page showing Ember chat user flows as Mermaid diagrams
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { MermaidDiagram } from '@/components/projects/shared/MermaidDiagram';
import {
  MapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

// Main flow diagram - complete overview
const MAIN_FLOW = `flowchart TB
    subgraph Entry["User Opens Ember Chat"]
        START([User Arrives])
        START --> NEW{New User?}
        NEW -->|Yes| ONBOARD[Onboarding Sequence]
        NEW -->|No| RETURNING[Returning User]
        ONBOARD --> AVATAR_CHOICE{Create Avatar?}
        AVATAR_CHOICE -->|"Create My Avatar"| AVATAR_FLOW[Avatar Creation Flow]
        AVATAR_CHOICE -->|"Skip for now"| CHAT_TYPE
        AVATAR_FLOW --> CHAT_TYPE
        RETURNING --> CHAT_TYPE
    end

    subgraph ChatType["Chat Layout"]
        CHAT_TYPE{Where opened?}
        CHAT_TYPE -->|Home Page| EMBEDDED[Embedded Chat]
        CHAT_TYPE -->|Anywhere else| SIDEBAR[Sidebar Chat]
    end

    subgraph EmbeddedFlow["Embedded Chat - Home Page"]
        EMBEDDED --> GREETING["Greeting Message<br/>'Good morning/afternoon/evening, Name!'"]
        GREETING --> PILLS[Feeling Pills - max 4 shown]
    end

    subgraph SidebarFlow["Sidebar Chat"]
        SIDEBAR --> CONTEXT{Context?}
        CONTEXT -->|Learn page| LEARN_ACTIONS[Learn Quick Actions]
        CONTEXT -->|Explore page| EXPLORE_ACTIONS[Explore Quick Actions]
        CONTEXT -->|Project page| PROJECT_ACTIONS[Project Quick Actions]
        CONTEXT -->|Other| DEFAULT_ACTIONS[Default Quick Actions]
    end

    subgraph AlwaysAvailable["Always Available"]
        CHAT_INPUT[Chat Input - Free Text]
        PLUS_MENU[Plus Menu - +]
        DRAG_DROP[Drag & Drop Files]
        SLASH_CMD[/clear Command]
    end

    PILLS --> CHAT_INPUT
    LEARN_ACTIONS --> CHAT_INPUT
    EXPLORE_ACTIONS --> CHAT_INPUT
    PROJECT_ACTIONS --> CHAT_INPUT
    DEFAULT_ACTIONS --> CHAT_INPUT`;

// Feeling Pills diagram
const FEELING_PILLS_FLOW = `flowchart TB
    subgraph Pills["Feeling Pills - Home Page"]
        direction TB
        PILLS_INTRO[/"Up to 4 pills shown based on:<br/>• User's signup interests<br/>• Time of day<br/>• Day of week<br/>• Completed actions"/]
    end

    subgraph PillOptions["All Pill Options"]
        P1["Share something I've<br/>been working on"]
        P2["Play a game"]
        P3["See this week's challenge"]
        P4["Learn something new"]
        P5["Sell a product or service"]
        P6["Explore what others<br/>are making"]
        P7["Connect with others"]
        P8["Personalize my experience"]
        P9["What's trending today?"]
        P10["Give me a quick win"]
        P11["Make my avatar<br/>(only if no avatar)"]
    end

    PILLS_INTRO --> PillOptions

    subgraph Actions["What Happens"]
        A1[Project Import Options]
        A2[Game Picker Modal]
        A3["→ 'Show me this week's challenge'"]
        A4["→ 'I want to learn something new about AI'"]
        A5["→ 'I want to sell a product or service'"]
        A6["→ 'Show me what others are making'"]
        A7["→ 'Help me find people to connect with'"]
        A8["→ 'Help me personalize my AllThrive experience'"]
        A9["→ 'Show me what's trending today'"]
        A10["→ 'I want a quick win to start my day'"]
        A11[Avatar Creation Flow]
    end

    P1 --> A1
    P2 --> A2
    P3 --> A3
    P4 --> A4
    P5 --> A5
    P6 --> A6
    P7 --> A7
    P8 --> A8
    P9 --> A9
    P10 --> A10
    P11 --> A11`;

// Share/Project Import flow
const PROJECT_IMPORT_FLOW = `flowchart TB
    subgraph Trigger["User Clicks"]
        SHARE["'Share something I've been working on'"]
    end

    SHARE --> EMBER_RESPONSE["Ember: 'Great! I'd love to see<br/>what you've been creating.'"]

    subgraph Options["4 Import Options"]
        OPT1["Connect to an integration<br/>'Pull from GitHub, GitLab,<br/>Figma, or YouTube'"]
        OPT2["Paste in a URL<br/>'Import from any website<br/>or repository URL'"]
        OPT3["Upload a project<br/>'Upload images, files,<br/>or documents'"]
        OPT4["Chrome extension<br/>'Install our extension to<br/>easily import from anywhere'"]
    end

    EMBER_RESPONSE --> OPT1
    EMBER_RESPONSE --> OPT2
    EMBER_RESPONSE --> OPT3
    EMBER_RESPONSE --> OPT4

    subgraph IntegrationPicker["Integration Picker"]
        GITHUB["GitHub"]
        GITLAB["GitLab"]
        FIGMA["Figma"]
        YOUTUBE["YouTube"]
    end

    OPT1 --> IntegrationPicker

    subgraph GitHubFlow["GitHub Flow"]
        GH1[OAuth Connect]
        GH2[Select Repository]
        GH3[Import Project]
        GH1 --> GH2 --> GH3
    end

    subgraph GitLabFlow["GitLab Flow"]
        GL1[OAuth Connect]
        GL2[Select Project]
        GL3[Import Project]
        GL1 --> GL2 --> GL3
    end

    subgraph FigmaFlow["Figma Flow"]
        FG1[OAuth Connect]
        FG2[Paste Design URL]
        FG3[Import Design]
        FG1 --> FG2 --> FG3
    end

    subgraph YouTubeFlow["YouTube Flow"]
        YT1[Paste Video URL]
        YT2[Import Video]
        YT1 --> YT2
    end

    GITHUB --> GitHubFlow
    GITLAB --> GitLabFlow
    FIGMA --> FigmaFlow
    YOUTUBE --> YouTubeFlow

    OPT2 --> URL_MSG["→ 'I want to import a project from a URL'"]
    URL_MSG --> AI_ANALYZE[AI Analyzes URL & Imports]

    OPT3 --> FILE_PICKER[Opens File Picker Dialog]
    FILE_PICKER --> UPLOAD_FLOW[Upload & Process Files]

    OPT4 --> COMING_SOON[Coming Soon Modal]`;

// Games flow
const GAMES_FLOW = `flowchart TB
    subgraph Trigger["User Clicks"]
        PLAY["'Play a game'"]
    end

    PLAY --> MODAL["Game Picker Modal"]

    subgraph Games["Available Games"]
        G1["Context Snake<br/>Classic snake game with AI twist"]
        G2["AI Trivia Quiz<br/>Test your AI knowledge"]
        G3["Ethics Defender<br/>Explore AI ethics scenarios"]
        G4["Prompt Battle<br/>Compete in prompt engineering"]
    end

    MODAL --> G1
    MODAL --> G2
    MODAL --> G3
    MODAL --> G4

    G1 --> PLAY_G1[Launch Snake Game]
    G2 --> PLAY_G2[Launch Trivia Quiz]
    G3 --> PLAY_G3[Launch Ethics Game]
    G4 --> PLAY_G4[Launch Prompt Battle]`;

// Quick Actions flow
const QUICK_ACTIONS_FLOW = `flowchart TB
    subgraph Sidebar["Sidebar Chat Opened"]
        CONTEXT{Context Detected}
    end

    subgraph LearnContext["Learn Context"]
        L1["Learn AI Basics"]
        L2["Quiz Me"]
        L3["My Progress"]
        L4["What Next?"]
    end

    subgraph ExploreContext["Explore Context"]
        E1["Trending Projects"]
        E2["Find Projects"]
        E3["Recommend For Me"]
        E4["Similar Projects"]
    end

    subgraph ProjectContext["Project Context"]
        P1["Paste a URL"]
        P2["Make Infographic"]
        P3["From GitHub"]
        P4["Upload Media"]
    end

    subgraph DefaultContext["Default Context"]
        D1["I need help"]
        D2["I don't know what to do next"]
        D3["I want to do something fun"]
    end

    CONTEXT -->|Learn page| LearnContext
    CONTEXT -->|Explore page| ExploreContext
    CONTEXT -->|Project page| ProjectContext
    CONTEXT -->|Other| DefaultContext

    subgraph LearnMessages["Messages Sent"]
        LM1["→ 'Teach me the basics of AI'"]
        LM2["→ 'Give me a quick quiz on what I've learned'"]
        LM3["→ 'Show me my learning progress'"]
        LM4["→ 'What should I learn next?'"]
    end

    L1 --> LM1
    L2 --> LM2
    L3 --> LM3
    L4 --> LM4

    subgraph ExploreMessages["Messages Sent"]
        EM1["→ 'Show me trending projects'"]
        EM2["→ 'Help me find interesting projects'"]
        EM3["→ 'Recommend projects based on my interests'"]
        EM4["→ 'Find projects similar to what I've liked'"]
    end

    E1 --> EM1
    E2 --> EM2
    E3 --> EM3
    E4 --> EM4

    subgraph ProjectMessages["Messages Sent"]
        PM1["→ 'I want to import a project from a URL'"]
        PM2["→ 'Help me create an image or infographic'"]
        PM3["→ 'I want to import a project from GitHub'"]
        PM4["→ 'I want to upload media to create a project'"]
    end

    P1 --> PM1
    P2 --> PM2
    P3 --> PM3
    P4 --> PM4

    subgraph DefaultMessages["Messages Sent"]
        DM1["→ 'I need help with something'"]
        DM2["→ 'What can I do on AllThrive?'"]
        DM3["→ 'Suggest something fun for me to do'"]
    end

    D1 --> DM1
    D2 --> DM2
    D3 --> DM3`;

// Plus Menu flow
const PLUS_MENU_FLOW = `flowchart TB
    subgraph PlusButton["Plus Menu (+)"]
        PLUS["Click + Button"]
    end

    subgraph Primary["Primary Options"]
        PR1["Import from URL"]
        PR2["Upload Image or Video"]
        PR3["Ask for Help"]
        PR4["Clear Conversation"]
    end

    subgraph MoreIntegrations["More Integrations"]
        MI1["Create Image/Infographic"]
        MI2["Add from GitHub"]
        MI3["Add from GitLab"]
        MI4["Add from Figma"]
        MI5["Add from YouTube"]
        MI6["Describe Anything"]
        MI7["Create Product<br/>(admins/creators only)"]
    end

    PLUS --> Primary
    PLUS --> MoreIntegrations

    subgraph PrimaryActions["Actions"]
        PA1["→ 'I want to import a project from a URL'"]
        PA2[Opens File Picker]
        PA3["→ 'I need help with something'"]
        PA4[Clears Chat & Resets to Greeting]
    end

    PR1 --> PA1
    PR2 --> PA2
    PR3 --> PA3
    PR4 --> PA4

    subgraph MoreActions["Actions"]
        MA1["→ 'Help me create an image or infographic'"]
        MA2[Starts GitHub OAuth Flow]
        MA3[Starts GitLab OAuth Flow]
        MA4[Starts Figma OAuth Flow]
        MA5["→ 'I want to import a YouTube video as a project'"]
        MA6["→ 'I want to describe a project to create'"]
        MA7[Coming Soon]
    end

    MI1 --> MA1
    MI2 --> MA2
    MI3 --> MA3
    MI4 --> MA4
    MI5 --> MA5
    MI6 --> MA6
    MI7 --> MA7`;

// Learning Goals flow
const LEARNING_GOALS_FLOW = `flowchart TB
    subgraph Trigger["Learning Setup"]
        EMBER["Ember: 'Hey there! I'm Ember,<br/>your AI learning companion.'<br/><br/>'What brings you here today?<br/>This helps me personalize your learning path.'"]
    end

    subgraph Goals["Learning Goal Options"]
        G1["Build AI Projects<br/>🚀<br/>'Get hands-on with tools like<br/>LangChain and build real applications.'"]
        G2["Understand AI Concepts<br/>💡<br/>'Learn the fundamentals of AI<br/>models, prompting, and workflows.'"]
        G3["Career Exploration<br/>💼<br/>'Discover how AI can boost<br/>your productivity and career.'"]
        G4["Just Exploring<br/>🧭<br/>'I'm curious about AI and<br/>want to look around.'"]
    end

    EMBER --> Goals
    EMBER --> SKIP["'Skip for now - I'll figure it out as I go'"]

    G1 --> PERSONALIZED[Personalized Learning Path]
    G2 --> PERSONALIZED
    G3 --> PERSONALIZED
    G4 --> PERSONALIZED
    SKIP --> GENERAL[General Experience]`;

// Onboarding flow
const ONBOARDING_FLOW = `flowchart TB
    subgraph NewUser["New User First Visit"]
        ARRIVE[User Opens Ember Chat]
    end

    subgraph IntroSequence["Onboarding Intro - Typewriter Animation"]
        LINE1["'Hi, {name}! I'm Ember, your guide<br/>throughout your All Thrive journey.'"]
        LINE2["'As you explore AI and our community,<br/>I'll be learning about you to give you<br/>a more personalized experience.'"]
        LINE3["'Let's start by creating<br/>your All Thrive Avatar.'"]
    end

    ARRIVE --> LINE1
    LINE1 --> LINE2
    LINE2 --> LINE3

    subgraph Buttons["Action Buttons"]
        CREATE["Create My Avatar ✨<br/>(Primary Button)"]
        SKIP["Skip for now<br/>(Link)"]
    end

    LINE3 --> CREATE
    LINE3 --> SKIP

    CREATE --> AVATAR[Avatar Creation Flow]
    AVATAR --> MAIN_CHAT[Main Chat Experience]
    SKIP --> MAIN_CHAT`;

interface FlowSection {
  id: string;
  title: string;
  description: string;
  diagram: string;
}

const FLOW_SECTIONS: FlowSection[] = [
  {
    id: 'main',
    title: 'Complete Overview',
    description: 'High-level view of all Ember chat entry points and flows',
    diagram: MAIN_FLOW,
  },
  {
    id: 'onboarding',
    title: 'New User Onboarding',
    description: 'First-time user experience with intro messages and avatar creation',
    diagram: ONBOARDING_FLOW,
  },
  {
    id: 'pills',
    title: 'Feeling Pills (Home Page)',
    description: 'All 11 personalized pill options and what each triggers',
    diagram: FEELING_PILLS_FLOW,
  },
  {
    id: 'import',
    title: 'Project Import Flow',
    description: 'What happens when user clicks "Share something I\'ve been working on"',
    diagram: PROJECT_IMPORT_FLOW,
  },
  {
    id: 'games',
    title: 'Games Flow',
    description: 'Game picker and available games when user clicks "Play a game"',
    diagram: GAMES_FLOW,
  },
  {
    id: 'quick-actions',
    title: 'Context-Aware Quick Actions (Sidebar)',
    description: 'Quick actions shown in sidebar based on current page context',
    diagram: QUICK_ACTIONS_FLOW,
  },
  {
    id: 'plus-menu',
    title: 'Plus Menu (+)',
    description: 'Always-available menu with import and integration options',
    diagram: PLUS_MENU_FLOW,
  },
  {
    id: 'learning',
    title: 'Learning Goal Selection',
    description: 'Goal selection for personalizing the learning experience',
    diagram: LEARNING_GOALS_FLOW,
  },
];

export default function EmberFlowsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(FLOW_SECTIONS.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-full">
          {/* Header */}
          <header className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                  <MapIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    Ember <span className="text-orange-600 dark:text-orange-400">User Flows</span>
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Visual documentation of all Ember chat interaction paths
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </header>

          {/* Flow Sections */}
          <div className="space-y-4">
            {FLOW_SECTIONS.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {section.title}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {section.description}
                      </p>
                    </div>
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="mt-4 overflow-x-auto">
                        <MermaidDiagram
                          code={section.diagram}
                          className="min-w-[800px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <footer className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Source Files
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>
                <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx
                </code>{' '}
                - Home page chat
              </li>
              <li>
                <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  frontend/src/components/chat/layouts/SidebarChatLayout.tsx
                </code>{' '}
                - Sidebar chat
              </li>
              <li>
                <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  frontend/src/components/chat/ChatPlusMenu.tsx
                </code>{' '}
                - Plus menu
              </li>
              <li>
                <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  frontend/src/components/chat/messages/ProjectImportOptionsMessage.tsx
                </code>{' '}
                - Import options
              </li>
            </ul>
          </footer>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
